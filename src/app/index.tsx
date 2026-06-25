import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ImportPreviewCard } from '@/components/ImportPreviewCard';
import { MetadataRecoveryCard } from '@/components/MetadataRecoveryCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProjectCard } from '@/components/ProjectCard';
import { theme } from '@/constants/theme';
import { importProjectBackup, validateBackupZip } from '@/data/backupService';
import { getMetadataHealth } from '@/data/metadataHealth';
import {
  getLatestSnapshotFileHealth,
  hasRecoverableMetadataSnapshot,
  restoreMetadataFromLatestSnapshot,
} from '@/data/metadataSnapshotService';
import { getAllProjects } from '@/data/projectStorage';
import { getStatsForProject } from '@/data/stats';
import type { BackupManifest } from '@/types/backup';
import type { Project } from '@/types/project';
import { pickBackupZipFile } from '@/utils/documentPicker';

type ProjectListItem = Project & {
  totalPhotos: number;
  latestPhotoUri?: string;
  latestPhotoDate?: string;
};

type RecoveryInfo = {
  snapshotCreatedAt: string;
  projectCount: number;
  photoCount: number;
};

export default function ProjectListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [pendingZipUri, setPendingZipUri] = useState<string | null>(null);
  const [pendingManifest, setPendingManifest] = useState<BackupManifest | null>(null);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);
  const [showRecoveryCard, setShowRecoveryCard] = useState(true);
  const [restoringSnapshot, setRestoringSnapshot] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const projects = await getAllProjects();
    const enriched = await Promise.all(
      projects.map(async (project) => {
        const stats = await getStatsForProject(project.id);
        return {
          ...project,
          totalPhotos: stats.totalPhotos,
          latestPhotoUri: project.coverPhotoUri,
          latestPhotoDate: stats.latestPhotoDate ?? undefined,
        };
      })
    );
    setItems(enriched);

    const [metadataHealth, recoverable] = await Promise.all([
      getMetadataHealth(),
      hasRecoverableMetadataSnapshot(),
    ]);

    if (
      recoverable &&
      (enriched.length === 0 ||
        metadataHealth.projectsCorrupted ||
        metadataHealth.photosCorrupted)
    ) {
      const snapshotInfo = await getLatestSnapshotFileHealth();
      if (snapshotInfo.createdAt) {
        setRecoveryInfo({
          snapshotCreatedAt: snapshotInfo.createdAt,
          projectCount: snapshotInfo.projectCount,
          photoCount: snapshotInfo.photoCount,
        });
      } else {
        setRecoveryInfo(null);
      }
    } else {
      setRecoveryInfo(null);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems])
  );

  const resetImportPreview = () => {
    setPreviewVisible(false);
    setPendingZipUri(null);
    setPendingManifest(null);
    setPendingPhotoCount(0);
  };

  const handleImportBackup = async () => {
    try {
      const zipUri = await pickBackupZipFile();
      if (!zipUri) {
        return;
      }

      setValidating(true);
      const validation = await validateBackupZip(zipUri);
      setValidating(false);

      if (!validation.valid || !validation.manifest) {
        Alert.alert(
          'Invalid backup',
          validation.errors[0] ?? 'This does not look like a valid Progression backup.'
        );
        return;
      }

      setPendingZipUri(zipUri);
      setPendingManifest(validation.manifest);
      setPendingPhotoCount(validation.photoCount ?? validation.manifest.photos.length);
      setPreviewVisible(true);
    } catch {
      setValidating(false);
      Alert.alert('Import failed', 'Could not import this backup.');
    }
  };

  const confirmImport = async () => {
    if (!pendingZipUri) {
      return;
    }

    try {
      setImporting(true);
      const importedProject = await importProjectBackup(pendingZipUri);
      resetImportPreview();
      await loadItems();
      Alert.alert('Import complete', 'Project imported successfully.');
      router.push(`/projects/${importedProject.id}`);
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof Error ? error.message : 'Could not import this backup.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    try {
      setRestoringSnapshot(true);
      await restoreMetadataFromLatestSnapshot();
      setShowRecoveryCard(false);
      await loadItems();
      Alert.alert('Restore complete', 'Metadata restored from local snapshot.');
    } catch (error) {
      Alert.alert(
        'Restore failed',
        error instanceof Error ? error.message : 'Could not restore this snapshot.'
      );
    } finally {
      setRestoringSnapshot(false);
    }
  };

  const importButton = (
    <PrimaryButton
      title={validating ? 'Validating...' : 'Import Backup'}
      variant="secondary"
      onPress={handleImportBackup}
      loading={validating}
      disabled={validating || importing}
      style={styles.importButton}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Projects</Text>
        <Text style={styles.subtitle}>Track visual progress over time.</Text>
        <Text style={styles.privacy}>Your photos stay on this device.</Text>
        <Text style={styles.backupNote}>
          Your progress is yours. Export a backup anytime and restore it later.
        </Text>
        {showRecoveryCard && recoveryInfo ? (
          <MetadataRecoveryCard
            snapshotCreatedAt={recoveryInfo.snapshotCreatedAt}
            projectCount={recoveryInfo.projectCount}
            photoCount={recoveryInfo.photoCount}
            onRestoreLatest={() => {
              void handleRestoreSnapshot();
            }}
            onDismiss={() => setShowRecoveryCard(false)}
          />
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            title="No projects yet"
            message="Create your first progress project to start tracking change over time."
            actionLabel="New Project"
            onAction={() => router.push('/projects/new')}
          />
          {importButton}
          {restoringSnapshot ? (
            <ActivityIndicator color={theme.accent} style={styles.restoreSpinner} />
          ) : null}
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              totalPhotos={item.totalPhotos}
              latestPhotoUri={item.latestPhotoUri}
              latestPhotoDate={item.latestPhotoDate}
              onPress={() => router.push(`/projects/${item.id}`)}
            />
          )}
          ListFooterComponent={
            <View style={styles.footerButtons}>
              <PrimaryButton
                title="New Project"
                onPress={() => router.push('/projects/new')}
              />
              {importButton}
              {restoringSnapshot ? (
                <ActivityIndicator color={theme.accent} style={styles.restoreSpinner} />
              ) : null}
            </View>
          }
        />
      )}

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={resetImportPreview}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Import Backup</Text>
            <Text style={styles.modalDescription}>
              Restore a Progression backup as a new project.
            </Text>
            {pendingManifest ? (
              <ImportPreviewCard
                manifest={pendingManifest}
                photoCount={pendingPhotoCount}
              />
            ) : null}
            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={resetImportPreview}
                style={styles.modalButton}
              />
              <PrimaryButton
                title={importing ? 'Importing...' : 'Import as New Project'}
                onPress={() => {
                  void confirmImport();
                }}
                loading={importing}
                disabled={importing}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  title: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: 15,
    marginBottom: theme.spacing.xs,
  },
  privacy: {
    color: theme.textMuted,
    fontSize: 14,
  },
  backupNote: {
    color: theme.textMuted,
    fontSize: 13,
    marginTop: theme.spacing.sm,
    lineHeight: 18,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  footerButtons: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  importButton: {
    marginTop: theme.spacing.sm,
  },
  restoreSpinner: {
    marginTop: theme.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
