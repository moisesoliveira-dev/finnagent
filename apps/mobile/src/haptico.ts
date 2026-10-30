import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** Um toque leve de confirmação. No navegador e onde o aparelho não vibra, não faz nada. */
export function toque(forte = false) {
  void Haptics.impact({ style: forte ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => undefined);
}
