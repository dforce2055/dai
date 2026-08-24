// dai · qué cliente SSH usa git, y si ese cliente llega al agente (Windows).
//
// En Windows conviven dos ssh.exe: el de OpenSSH for Windows (C:\Windows\System32\
// OpenSSH), que habla con el servicio `ssh-agent`, y el que trae Git for Windows
// (MSYS), que NO lo ve. Con una clave con passphrase el síntoma es desconcertante:
// `ssh -T` autentica (la firma la hace el agente) y `git push` pide la passphrase o,
// si nadie la contesta, cae a autenticación por password y muere con
// "Permission denied (publickey…)" — un error que apunta al lugar equivocado y se
// come una mañana buscando el problema en la clave, en el token o en el server.
//
// Núcleo puro: el I/O (git config, existsSync) vive en dai.mjs.

export const WINDOWS_OPENSSH = "C:/Windows/System32/OpenSSH/ssh.exe";

// ¿Por dónde habla el remoto? Decide qué consejo tiene sentido cuando el push falla.
export function remoteTransport(remote) {
  const r = String(remote ?? "").trim();
  if (!r) return null;
  if (/^ssh:\/\//i.test(r)) return "ssh";
  if (/^https?:\/\//i.test(r)) return "https";
  if (/^[\w.-]+@[^:]+:/.test(r)) return "ssh";   // scp-like: git@host:org/repo.git
  return null;                                    // git://, file://, ruta local…
}

// El binario de un core.sshCommand / GIT_SSH_COMMAND, que puede traer argumentos y
// comillas:  `"C:/Program Files/Git/usr/bin/ssh.exe" -v`  →  la ruta sola.
export function sshBinaryOf(cmd) {
  const s = String(cmd ?? "").trim();
  if (!s) return null;
  if (s[0] === '"' || s[0] === "'") {
    const end = s.indexOf(s[0], 1);
    return end === -1 ? s.slice(1) : s.slice(1, end);
  }
  const sp = s.search(/\s/);
  return sp === -1 ? s : s.slice(0, sp);
}

// ¿Esa ruta es el OpenSSH de Windows? Normalizado: mayúsculas y `\` vs `/` varían
// según quién haya escrito el config (git acepta las dos formas).
export function isWindowsOpenSsh(bin) {
  const p = String(bin ?? "").replace(/\\/g, "/").toLowerCase();
  return /(^|\/)system32\/openssh\/ssh(\.exe)?$/.test(p);
}

// Diagnóstico del cliente ssh que va a usar git. Entradas ya resueltas por el
// llamador; acá no se toca el disco ni se lanza un proceso.
//   platform          — process.platform
//   remote            — url de origin (o null)
//   config            — `git config --get core.sshCommand` (o null si no está)
//   env               — { GIT_SSH_COMMAND, GIT_SSH }
//   hasWindowsOpenSsh — existsSync(WINDOWS_OPENSSH)
//
// status:
//   n/a               → no aplica (no es Windows, o el remoto no habla SSH)
//   ok                → apunta al OpenSSH de Windows por core.sshCommand
//   ok-por-env        → apunta bien, pero desde una env var: se pierde al cerrar la terminal
//   otro-ssh          → apunta a otro ssh (el de MSYS, plink…)
//   bundled           → nadie lo configuró: git usa el suyo, que no ve el agente
//   bundled-sin-openssh → igual, pero no hay OpenSSH de Windows que recomendar
export function diagnoseGitSsh({ platform, remote, config, env = {}, hasWindowsOpenSsh = false } = {}) {
  if (platform !== "win32") return { status: "n/a", reason: "no-windows" };
  const transport = remoteTransport(remote);
  if (transport !== "ssh") return { status: "n/a", reason: transport ? "remoto-https" : "sin-remoto" };

  // Precedencia real de git: GIT_SSH_COMMAND > GIT_SSH > core.sshCommand.
  const [source, raw] =
    env.GIT_SSH_COMMAND ? ["GIT_SSH_COMMAND", env.GIT_SSH_COMMAND]
    : env.GIT_SSH ? ["GIT_SSH", env.GIT_SSH]
    : config ? ["core.sshCommand", config]
    : ["default", null];

  // Una env var pisando un core.sshCommand que ya estaba bien: el dev "arregló" el
  // config, no funciona, y no hay forma de verlo mirando el .gitconfig.
  const shadowed = source !== "default" && source !== "core.sshCommand" && Boolean(config);

  if (source === "default") {
    return hasWindowsOpenSsh
      ? { status: "bundled", source, bin: null, fix: WINDOWS_OPENSSH, shadowed }
      : { status: "bundled-sin-openssh", source, bin: null, fix: null, shadowed };
  }

  const bin = sshBinaryOf(raw);
  if (isWindowsOpenSsh(bin)) {
    return { status: source === "core.sshCommand" ? "ok" : "ok-por-env", source, bin, fix: null, shadowed };
  }
  return { status: "otro-ssh", source, bin, fix: hasWindowsOpenSsh ? WINDOWS_OPENSSH : null, shadowed };
}

// Qué decirle al dev cuando `git push` falla. El consejo de "pusheá a mano una vez"
// solo aplica a HTTPS, donde el credential manager pide la credencial la primera vez;
// contra un remoto SSH el push a mano falla EXACTAMENTE igual, así que mandarlo por ahí
// es hacerle perder el tiempo mientras el problema real (la clave, el agente) sigue ahí.
export function pushFailureHint(remote, branch) {
  if (remoteTransport(remote) === "ssh") {
    return [
      `El remoto habla SSH: en el push no interviene el token de gh/glab, solo tu clave.`,
      `Prueba a mano — así ves lo que ssh pregunta (p. ej. la passphrase de tu clave):`,
      `  git push -u origin ${branch}`,
      `Si te la pide en cada push, tu clave está en un agente que git no ve:  dai doctor`,
    ];
  }
  return [
    `Si es la primera vez contra este remoto, autentica pusheando a mano una vez:`,
    `  git push -u origin ${branch}`,
    `y vuelve a ejecutar:  dai pr`,
  ];
}
