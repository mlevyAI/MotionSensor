// Persistence interface for labeled examples.
// The web build implements this with IndexedDB (repository.web.ts); a future
// native build swaps in expo-sqlite + expo-file-system behind the same contract.

import { LabeledExample } from './types';

export interface ExampleRepository {
  init(): Promise<void>;
  add(example: LabeledExample): Promise<void>;
  all(): Promise<LabeledExample[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
