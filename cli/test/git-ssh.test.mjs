import { test } from "node:test";
import assert from "node:assert/strict";
import { remoteTransport, sshBinaryOf, isWindowsOpenSsh, diagnoseGitSsh, pushFailureHint, WINDOWS_OPENSSH } from "../lib/git-ssh.mjs";

test("remoteTransport distingue ssh de https", () => {
  assert.equal(remoteTransport("git@github.com:org/repo.git"), "ssh");
  assert.equal(remoteTransport("git@gitlab.acme.com:Grupo/sub/repo.git"), "ssh");
  assert.equal(remoteTransport("ssh://git@gitlab.acme.com:22/org/repo.git"), "ssh");
  assert.equal(remoteTransport("https://gitlab.acme.com/org/repo.git"), "https");
  assert.equal(remoteTransport("http://gitlab.acme.com/org/repo.git"), "https");
  assert.equal(remoteTransport("git://host/org/repo.git"), null);
  assert.equal(remoteTransport(""), null);
  assert.equal(remoteTransport(null), null);
});

test("sshBinaryOf extrae la ruta, con argumentos y con comillas", () => {
  assert.equal(sshBinaryOf("C:/Windows/System32/OpenSSH/ssh.exe"), "C:/Windows/System32/OpenSSH/ssh.exe");
  assert.equal(sshBinaryOf("ssh -v"), "ssh");
  assert.equal(sshBinaryOf('"C:/Program Files/Git/usr/bin/ssh.exe" -v'), "C:/Program Files/Git/usr/bin/ssh.exe");
  assert.equal(sshBinaryOf("'/usr/bin/ssh' -o Foo=bar"), "/usr/bin/ssh");
  assert.equal(sshBinaryOf('"C:/sin/cierre.exe'), "C:/sin/cierre.exe");
  assert.equal(sshBinaryOf(""), null);
  assert.equal(sshBinaryOf(undefined), null);
});

test("isWindowsOpenSsh tolera mayúsculas y barras invertidas", () => {
  assert.equal(isWindowsOpenSsh("C:/Windows/System32/OpenSSH/ssh.exe"), true);
  assert.equal(isWindowsOpenSsh("C:\\Windows\\System32\\OpenSSH\\ssh.exe"), true);
  assert.equal(isWindowsOpenSsh("c:/windows/system32/openssh/ssh"), true);
  assert.equal(isWindowsOpenSsh("C:/Program Files/Git/usr/bin/ssh.exe"), false);
  assert.equal(isWindowsOpenSsh("plink.exe"), false);
  assert.equal(isWindowsOpenSsh(null), false);
});

test("diagnoseGitSsh no opina fuera de Windows ni con remotos que no son SSH", () => {
  assert.equal(diagnoseGitSsh({ platform: "darwin", remote: "git@github.com:o/r.git" }).status, "n/a");
  assert.equal(diagnoseGitSsh({ platform: "linux", remote: "git@github.com:o/r.git" }).status, "n/a");
  const https = diagnoseGitSsh({ platform: "win32", remote: "https://gitlab.acme.com/o/r.git" });
  assert.equal(https.status, "n/a");
  assert.equal(https.reason, "remoto-https");
  assert.equal(diagnoseGitSsh({ platform: "win32", remote: null }).reason, "sin-remoto");
});

test("diagnoseGitSsh: sin configurar en Windows, git usa el ssh que no ve al agente", () => {
  const d = diagnoseGitSsh({ platform: "win32", remote: "git@gitlab.acme.com:o/r.git", config: null, hasWindowsOpenSsh: true });
  assert.equal(d.status, "bundled");
  assert.equal(d.source, "default");
  assert.equal(d.fix, WINDOWS_OPENSSH);
});

test("diagnoseGitSsh: sin OpenSSH de Windows no recomienda una ruta que no existe", () => {
  const d = diagnoseGitSsh({ platform: "win32", remote: "git@gitlab.acme.com:o/r.git", config: null, hasWindowsOpenSsh: false });
  assert.equal(d.status, "bundled-sin-openssh");
  assert.equal(d.fix, null);
});

test("diagnoseGitSsh: core.sshCommand al OpenSSH de Windows es el estado bueno", () => {
  const d = diagnoseGitSsh({
    platform: "win32", remote: "git@gitlab.acme.com:o/r.git",
    config: "C:/Windows/System32/OpenSSH/ssh.exe", hasWindowsOpenSsh: true,
  });
  assert.equal(d.status, "ok");
  assert.equal(d.source, "core.sshCommand");
  assert.equal(d.shadowed, false);
});

test("diagnoseGitSsh: otro ssh explícito se reporta con el suyo y el fix", () => {
  const d = diagnoseGitSsh({
    platform: "win32", remote: "git@gitlab.acme.com:o/r.git",
    config: '"C:/Program Files/Git/usr/bin/ssh.exe"', hasWindowsOpenSsh: true,
  });
  assert.equal(d.status, "otro-ssh");
  assert.equal(d.bin, "C:/Program Files/Git/usr/bin/ssh.exe");
  assert.equal(d.fix, WINDOWS_OPENSSH);
});

// La precedencia de git: GIT_SSH_COMMAND > GIT_SSH > core.sshCommand. Importa porque
// el dev "arregla" el config, no funciona, y mirando el .gitconfig no se ve por qué.
test("diagnoseGitSsh: la env var pisa el config y lo dice", () => {
  const d = diagnoseGitSsh({
    platform: "win32", remote: "git@gitlab.acme.com:o/r.git",
    config: "C:/Windows/System32/OpenSSH/ssh.exe",
    env: { GIT_SSH_COMMAND: "ssh -v" },
    hasWindowsOpenSsh: true,
  });
  assert.equal(d.status, "otro-ssh");
  assert.equal(d.source, "GIT_SSH_COMMAND");
  assert.equal(d.shadowed, true);
});

test("diagnoseGitSsh: GIT_SSH_COMMAND gana sobre GIT_SSH", () => {
  const d = diagnoseGitSsh({
    platform: "win32", remote: "git@gitlab.acme.com:o/r.git",
    env: { GIT_SSH_COMMAND: "C:/Windows/System32/OpenSSH/ssh.exe", GIT_SSH: "plink.exe" },
    hasWindowsOpenSsh: true,
  });
  assert.equal(d.source, "GIT_SSH_COMMAND");
  assert.equal(d.status, "ok-por-env");
});

test("diagnoseGitSsh: GIT_SSH se usa si no hay GIT_SSH_COMMAND", () => {
  const d = diagnoseGitSsh({
    platform: "win32", remote: "git@gitlab.acme.com:o/r.git",
    env: { GIT_SSH: "plink.exe" }, hasWindowsOpenSsh: true,
  });
  assert.equal(d.source, "GIT_SSH");
  assert.equal(d.status, "otro-ssh");
});

// El consejo viejo ("pusheá a mano una vez") solo arregla HTTPS. Con SSH el push a mano
// falla igual: repetirlo manda al dev a perder horas mirando la clave equivocada.
test("pushFailureHint no manda a repetir el push a mano cuando el remoto es SSH", () => {
  const ssh = pushFailureHint("git@gitlab.acme.com:o/r.git", "feature/ABC-1-x").join("\n");
  assert.match(ssh, /SSH/);
  assert.match(ssh, /passphrase/);
  assert.match(ssh, /dai doctor/);
  assert.doesNotMatch(ssh, /primera vez contra este remoto/);
});

test("pushFailureHint mantiene el consejo del credential manager en HTTPS", () => {
  const https = pushFailureHint("https://gitlab.acme.com/o/r.git", "feature/ABC-1-x").join("\n");
  assert.match(https, /primera vez contra este remoto/);
  assert.match(https, /git push -u origin feature\/ABC-1-x/);
  assert.doesNotMatch(https, /passphrase/);
});

test("pushFailureHint cae al consejo genérico si el remoto es raro", () => {
  const raro = pushFailureHint("git://host/o/r.git", "b").join("\n");
  assert.match(raro, /primera vez contra este remoto/);
});
