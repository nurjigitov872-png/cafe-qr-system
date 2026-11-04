// No media downloads, permissions, storage or API calls.
// History is explicitly labelled by its source, never by server/client wall clocks.
export function shouldPlayNotification(event, { live, fresh }) {
  return Boolean(event?.key && live && fresh);
}
export function createNotificationSound(scope = window, onState = () => {}) {
  let context;
  const fail = code => { const error = new Error(code); error.code = code; return error; };
  function play() {
    if (!context || context.state !== "running") throw fail("soundBlocked");
    try {
      const start = context.currentTime;
      for (const [frequency, delay] of [[880, 0], [1174.66, 0.16]]) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start + delay);
        oscillator.connect(gain); gain.connect(context.destination);
        gain.gain.setValueAtTime(0, start + delay);
        gain.gain.linearRampToValueAtTime(0.18, start + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + delay + 0.32);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start + delay); oscillator.stop(start + delay + 0.34);
      }
      onState("soundPlayed");
    } catch (error) { throw fail(error.code || "soundFailed"); }
  }
  async function activate() {
    const Audio = scope.AudioContext || scope.webkitAudioContext;
    if (!Audio) throw fail("soundUnsupported");
    let timer;
    try {
      if (!context || context.state === "closed") {
        context = new Audio();
        context.onstatechange = () => onState(context.state === "running" ? "soundReady" : "soundBlocked");
      }
      // Both construction and resume happen synchronously within the click handler.
      const resumed = context.resume();
      await Promise.race([resumed, new Promise((_, reject) => { timer = setTimeout(() => reject(fail("soundBlocked")), 2000); })]);
      if (context.state !== "running") throw fail("soundBlocked");
    } catch (error) { throw fail(error.code || (error.name === "NotAllowedError" ? "soundBlocked" : "soundFailed")); }
    finally { clearTimeout(timer); }
  }
  function close() { if (context) { context.onstatechange = null; if (context.state !== "closed") context.close().catch(() => {}); } }
  async function playback({ gesture = false } = {}) {
    if (gesture) await activate();
    else {
      // Only a context previously unlocked by a click may resume automatically.
      if (!context || context.state === "closed") throw fail("soundBlocked");
      if (context.state !== "running") {
        let timer;
        try {
          await Promise.race([context.resume(), new Promise((_, reject) => { timer = setTimeout(() => reject(fail("soundBlocked")), 2000); })]);
        } catch { throw fail("soundBlocked"); }
        finally { clearTimeout(timer); }
      }
    }
    play();
  }
  return { activate, play, playback, close };
}
