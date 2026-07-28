import * as Sharing from 'expo-sharing';

async function shareFile(
  fileUri: string,
  options: {
    mimeType: string;
    dialogTitle: string;
    UTI: string;
  }
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, options);
}

export async function shareBackupFile(fileUri: string): Promise<void> {
  await shareFile(fileUri, {
    mimeType: 'application/zip',
    dialogTitle: 'Backup Progression Project',
    UTI: 'public.zip',
  });
}

export async function shareTimelapseFile(fileUri: string): Promise<void> {
  await shareFile(fileUri, {
    mimeType: 'image/gif',
    dialogTitle: 'Share Timelapse',
    UTI: 'com.compuserve.gif',
  });
}
