import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ProjectTypeCard } from '@/components/ProjectTypeCard';
import { PROJECT_TYPES } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import { createProject } from '@/data/projectStorage';
import type { ProjectType } from '@/types/project';

export default function NewProjectScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ProjectType | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!selectedType) {
      setError('Please select a project type.');
      return;
    }
    if (!name.trim()) {
      setError('Project name cannot be empty.');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const project = await createProject({ name: name.trim(), type: selectedType });
      router.replace(`/projects/${project.id}`);
    } catch {
      setError('Could not create project. Please try again.');
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Project Type</Text>
        {PROJECT_TYPES.map((item) => (
          <ProjectTypeCard
            key={item.type}
            type={item.type}
            label={item.label}
            description={item.description}
            selected={selectedType === item.type}
            onPress={() => {
              setSelectedType(item.type);
              setError(null);
            }}
          />
        ))}

        <Text style={styles.sectionTitle}>Project Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          placeholder="e.g. Skincare Journey"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="words"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton
          title="Create Project"
          onPress={handleCreate}
          loading={creating}
          style={styles.createButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.text,
    fontSize: 16,
  },
  error: {
    color: theme.danger,
    fontSize: 14,
    marginTop: theme.spacing.sm,
  },
  createButton: {
    marginTop: theme.spacing.lg,
  },
});
