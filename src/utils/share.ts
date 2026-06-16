import * as Sharing from 'expo-sharing';

export async function shareBackupFile(fileUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/zip',
    dialogTitle: 'Backup Progression Project',
    UTI: 'public.zip',
  });
}
