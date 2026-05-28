/** Turn Electron accelerator strings into readable labels (Windows-friendly). */
export function formatHotkey(accel: string): string {
  return accel
    .replace(/CommandOrControl/gi, 'Ctrl')
    .replace(/Command/gi, 'Ctrl')
    .replace(/Control/gi, 'Ctrl')
    .replace(/\+/g, ' + ')
}
