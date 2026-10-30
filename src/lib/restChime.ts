/**
 * Bip de fin de repos (Web Audio, sans fichier) : iOS ignore la vibration, le son prend le relais.
 * iOS n'autorise le son qu'après un geste : `unlockRestChime()` est appelé au tap qui lance le repos,
 * `playRestChime()` à la fin du minuteur. Sans Web Audio, ou si le son est bloqué, rien ne se passe.
 */

type AudioContextCtor = new () => AudioContext;

let context: AudioContext | null = null;

function audioContextCtor(): AudioContextCtor | undefined {
  const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext;
}

/**
 * Safari (16.4+) : le son se mêle à la musique en cours au lieu de la couper, et respecte le mode silencieux.
 */
function preferAmbientAudio(): void {
  try {
    const session = (globalThis.navigator as unknown as { audioSession?: { type: string } } | undefined)?.audioSession;
    if (session && session.type !== 'ambient') session.type = 'ambient';
  } catch {
    // API absente ou refusée.
  }
}

/** Crée ou réveille le contexte audio. À appeler pendant un geste de l'utilisateur. */
export function unlockRestChime(): void {
  try {
    if (!context) {
      const Ctor = audioContextCtor();
      if (!Ctor) return;
      preferAmbientAudio();
      context = new Ctor();
      // Ancien iOS : un tampon muet joué pendant le geste débloque la sortie audio.
      const buffer = context.createBuffer(1, 1, context.sampleRate);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
    }
    if (context.state !== 'running') context.resume().catch(() => undefined);
  } catch {
    context = null;
  }
}

/** Bip court et discret (~200 ms). Sans contexte débloqué au préalable, ne fait rien. */
export function playRestChime(): void {
  const ctx = context;
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    // Attaque et extinction douces : pas de clic.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  } catch {
    // Sortie audio indisponible : la fin du repos reste visible (et vibrée quand c'est possible).
  }
}

/** Tests uniquement : oublie le contexte audio. */
export function resetRestChimeForTests(): void {
  context = null;
}
