#!/usr/bin/env node
/**
 * Arranca el FastAPI hermano y luego el frontend (Vite/Next/etc), en paralelo.
 *
 * Flujo:
 *   1. Lanza uvicorn como child process (venv del proyecto hermano).
 *   2. Polla GET <HEALTH_PATH> hasta que responde 200 o se vence el timeout.
 *   3. Una vez healthy, lanza el dev del frontend.
 *   4. Cualquier señal (Ctrl+C) limpia ambos procesos.
 *
 * Overridables via env:
 *   API_DIR               (default: ../nexus_back)
 *   API_HOST              (default: 127.0.0.1)
 *   API_PORT              (default: 8083)
 *   API_HEALTH_PATH       (default: /health)
 *   API_ENTRYPOINT        (default: app:app)
 *   API_READY_TIMEOUT_MS  (default: 60000)
 *   MIN_API_VERSION       (default: 0.0.0; "0.0.0" = sin enforcement, sólo skip si healthy)
 */

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const API_DIR = resolve(ROOT, process.env.API_DIR ?? "../nexus_back");
const API_HOST = process.env.API_HOST ?? "127.0.0.1";
const API_PORT = Number(process.env.API_PORT ?? 8083);
const HEALTH_PATH = process.env.API_HEALTH_PATH ?? "/health";
const ENTRYPOINT = process.env.API_ENTRYPOINT ?? "app:app";
const API_READY_TIMEOUT_MS = Number(process.env.API_READY_TIMEOUT_MS ?? 60000);
// Versión mínima esperada (leída de GET /). Si el API corriendo es menor, lo mata y respawnea.
// "0.0.0" = desactivado (sólo skip si /health responde, sin checar versión).
const MIN_API_VERSION = process.env.MIN_API_VERSION ?? "0.0.0";

// ── Colors ──────────────────────────────────────────────────────────────────
const c = {
	dim: (s) => `\x1b[2m${s}\x1b[0m`,
	cyan: (s) => `\x1b[36m${s}\x1b[0m`,
	magenta: (s) => `\x1b[35m${s}\x1b[0m`,
	green: (s) => `\x1b[32m${s}\x1b[0m`,
	red: (s) => `\x1b[31m${s}\x1b[0m`,
	yellow: (s) => `\x1b[33m${s}\x1b[0m`,
	bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const ts = () => new Date().toTimeString().slice(0, 8);
const prefix = (tag, color) => `${c.dim(ts())} ${color(`[${tag}]`)} `;
const logApi = (line) => process.stdout.write(prefix("api", c.cyan) + line + "\n");
const logWeb = (line) => process.stdout.write(prefix("web", c.magenta) + line + "\n");
const logSys = (line) => process.stdout.write(prefix("dev", c.yellow) + line + "\n");

// ── Locate Python venv ──────────────────────────────────────────────────────
function findPython() {
	const candidates =
		process.platform === "win32"
			? ["Scripts/python.exe", "Scripts/python"]
			: ["bin/python", "bin/python3"];
	for (const rel of candidates) {
		const p = resolve(API_DIR, ".venv", rel);
		if (existsSync(p)) return p;
	}
	return null;
}

// ── Health probe ────────────────────────────────────────────────────────────
async function waitForHealth(url, timeoutMs) {
	const started = Date.now();
	let lastErr = null;
	while (Date.now() - started < timeoutMs) {
		try {
			const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
			if (r.ok) return { ok: true, elapsedMs: Date.now() - started };
		} catch (err) {
			lastErr = err;
		}
		await new Promise((res) => setTimeout(res, 500));
	}
	return { ok: false, elapsedMs: Date.now() - started, lastErr };
}

// ── Version probe + kill-on-port ────────────────────────────────────────────
function versionGte(a, b) {
	const p = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
	const [aMa, aMi, aP] = p(a);
	const [bMa, bMi, bP] = p(b);
	if (aMa !== bMa) return aMa > bMa;
	if (aMi !== bMi) return aMi > bMi;
	return aP >= bP;
}

async function probeRunningApi(host, port, healthPath) {
	let running = false;
	try {
		const h = await fetch(`http://${host}:${port}${healthPath}`, {
			signal: AbortSignal.timeout(800),
		});
		if (h.ok) running = true;
	} catch {}
	if (!running) return { running: false, version: null };
	let version = null;
	try {
		const r = await fetch(`http://${host}:${port}/`, { signal: AbortSignal.timeout(800) });
		if (r.ok) {
			const json = await r.json();
			if (typeof json?.version === "string") version = json.version;
		}
	} catch {}
	return { running: true, version };
}

function killProcessOnPort(port) {
	try {
		if (process.platform === "win32") {
			const out = execSync("netstat -ano -p TCP", { encoding: "utf8" });
			const pids = new Set();
			for (const line of out.split("\n")) {
				if (!line.includes(`:${port} `) || !line.toUpperCase().includes("LISTENING")) continue;
				const parts = line.trim().split(/\s+/);
				const pid = parts[parts.length - 1];
				if (/^\d+$/.test(pid)) pids.add(pid);
			}
			for (const pid of pids) {
				try {
					execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
				} catch {}
			}
			return pids.size;
		}
		const pids = execSync(`lsof -ti:${port}`, { encoding: "utf8" })
			.trim()
			.split("\n")
			.filter(Boolean);
		for (const pid of pids) {
			try {
				execSync(`kill -9 ${pid}`);
			} catch {}
		}
		return pids.length;
	} catch {
		return 0;
	}
}

// ── Pipe child output line-by-line with prefix ──────────────────────────────
function pipeLines(stream, logger) {
	let buf = "";
	stream.on("data", (chunk) => {
		buf += chunk.toString();
		let idx;
		while ((idx = buf.indexOf("\n")) >= 0) {
			const line = buf.slice(0, idx).replace(/\r$/, "");
			if (line.length > 0) logger(line);
			buf = buf.slice(idx + 1);
		}
	});
	stream.on("end", () => {
		if (buf.length > 0) logger(buf);
	});
}

// ── Spawn helpers ───────────────────────────────────────────────────────────
let apiProc = null;
let webProc = null;
let shuttingDown = false;

function shutdown(code = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	logSys("apagando procesos…");
	for (const p of [webProc, apiProc]) {
		if (p && p.exitCode === null) {
			try {
				p.kill(process.platform === "win32" ? undefined : "SIGTERM");
			} catch {}
		}
	}
	setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
	logSys(`api dir: ${c.bold(API_DIR)}`);
	if (!existsSync(API_DIR)) {
		logSys(c.red(`no existe ${API_DIR}. Set API_DIR env var si está en otra ruta.`));
		process.exit(1);
	}

	const healthUrl = `http://${API_HOST}:${API_PORT}${HEALTH_PATH}`;

	// Si el API ya está corriendo, verificar versión antes de decidir.
	const running = await probeRunningApi(API_HOST, API_PORT, HEALTH_PATH);
	if (running.running) {
		const versionOk =
			MIN_API_VERSION === "0.0.0" ||
			(running.version && versionGte(running.version, MIN_API_VERSION));
		if (versionOk) {
			const tag = running.version ? `v${running.version}` : "versión desconocida";
			logSys(c.green(`✓ API ya estaba arriba (${tag}) — skip spawn`));
			startWeb();
			return;
		}
		const got = running.version ?? "desconocida";
		logSys(
			c.yellow(`API existente es v${got}, se requiere >= v${MIN_API_VERSION} — reiniciando…`),
		);
		const killed = killProcessOnPort(API_PORT);
		if (killed > 0) logSys(c.dim(`procesos terminados: ${killed}`));
		await new Promise((r) => setTimeout(r, 800));
	}

	const python = findPython();
	if (!python) {
		logSys(c.red(`no encontré .venv en ${API_DIR}. Crea uno: cd ${API_DIR} && python -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt`));
		process.exit(1);
	}
	logSys(`python: ${c.bold(python)}`);

	const startedApi = Date.now();
	logApi(c.dim(`arrancando uvicorn ${ENTRYPOINT} en http://${API_HOST}:${API_PORT} …`));
	apiProc = spawn(
		python,
		["-m", "uvicorn", ENTRYPOINT, "--host", API_HOST, "--port", String(API_PORT)],
		{ cwd: API_DIR, env: { ...process.env, PYTHONUNBUFFERED: "1" } },
	);
	pipeLines(apiProc.stdout, logApi);
	pipeLines(apiProc.stderr, logApi);
	apiProc.on("exit", (code, signal) => {
		logApi(c.red(`uvicorn terminó (code=${code}, signal=${signal})`));
		if (!shuttingDown) shutdown(code ?? 1);
	});

	logSys(`esperando health en ${healthUrl} (timeout ${API_READY_TIMEOUT_MS}ms)…`);
	const { ok, elapsedMs, lastErr } = await waitForHealth(healthUrl, API_READY_TIMEOUT_MS);
	if (!ok) {
		logSys(c.red(`API no respondió healthy en ${elapsedMs}ms. Último error: ${lastErr?.message ?? "n/a"}`));
		shutdown(1);
		return;
	}
	const apiBootMs = Date.now() - startedApi;
	logSys(c.green(`✓ API healthy en ${elapsedMs}ms (boot total ${apiBootMs}ms) — ${healthUrl}`));
	startWeb();
})();

function startWeb() {
	logWeb(c.dim("arrancando frontend (npm run dev:web-only) …"));
	// Windows requiere shell:true para resolver .cmd/.bat (npm, vite); en POSIX no hace daño.
	webProc = spawn("npm run dev:web-only", {
		cwd: ROOT,
		env: { ...process.env, FORCE_COLOR: "1" },
		shell: true,
	});
	pipeLines(webProc.stdout, logWeb);
	pipeLines(webProc.stderr, logWeb);
	webProc.on("exit", (code, signal) => {
		logWeb(c.red(`frontend terminó (code=${code}, signal=${signal})`));
		shutdown(code ?? 0);
	});
}
