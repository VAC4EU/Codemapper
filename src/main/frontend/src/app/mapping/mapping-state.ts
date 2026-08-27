import { Mapping } from "./mapping";
import { Caches } from './caches';
import { Codes, Concepts, MappingData, Vocabularies } from "./mapping-data";
import { Operation } from "./operations";
import { Messages } from './messages';
import { AllTopics } from "./review";

export class MappingState {
  caches: Caches = new Caches();
  stacks: Stacks = new Stacks();

  constructor(public mapping: Mapping, caches?: Caches) {
    if (caches === undefined) {
      this.recache();
    } else {
      this.caches = caches;
    }
  }

  recache() {
    this.caches = this.mapping.caches();
    this.mapping.cleanupCheck(this.caches);
  }

  /// A fresh identity for change detection, sharing the mapping and caches.
  /// The mapping is already cloned once per operation in `runIntern`, so
  /// cloning again here would only duplicate work.
  reidentify(): MappingState {
    let state = new MappingState(this.mapping, this.caches);
    state.stacks = this.stacks;
    return state;
  }

  addMapping(data: MappingData) {
    this.mapping.addMapping(data);
    this.recache();
  }

  remap(
    umlsVersion: string,
    concepts: Concepts,
    codes: Codes,
    vocabularies: Vocabularies,
    messages: Messages,
  ) {
    this.mapping.remap(umlsVersion, {concepts, codes}, vocabularies, this.caches, messages);
    this.recache();
  }

  runIntern(op: Operation, allTopics: AllTopics, messages: Messages) {
    let inv = op.run({mapping: this.mapping, caches: this.caches, allTopics, messages});
    // detaches the objects captured by the inverse operation from the live mapping
    this.mapping = this.mapping.deepClone();
    this.recache();
    return inv;
  }

  public run(op: Operation, allTopics: AllTopics, messages: Messages) {
    console.log('Run', op);
    if (op.noUndo && this.stacks.hasUndo()) {
      alert('this operation cannot be undone, please save your mapping first');
      return;
    }
    let inv;
    try {
      inv = this.runIntern(op, allTopics, messages);
    } catch (err) {
      let msg = `could not run operation: ${(err as Error).message}`;
      console.trace(err);
      console.error(msg, op, err);
      alert(msg);
      return;
    }
    this.stacks.redoStack = [];
    if (inv !== undefined) {
      this.stacks.undoStack.push({description: op.describe(), op: inv});
    } else {
      console.log('no inverse operation');
    }
  }

  public undo(allTopics: AllTopics, messages: Messages) {
    let op = this.stacks.undoStack.pop();
    if (op === undefined) return;
    console.log('Undo', op.description);
    let inv = this.runIntern(op.op, allTopics, messages);
    if (inv !== undefined) {
      this.stacks.redoStack.push({description: op.description, op: inv});
    }
  }

  public redo(allTopics: AllTopics, messages: Messages) {
    let op = this.stacks.redoStack.pop();
    if (op === undefined) return;
    console.log('Redo', op.description);
    let inv = this.runIntern(op.op, allTopics, messages);
    if (inv !== undefined) {
      this.stacks.undoStack.push({description: op.op.describe(), op: inv});
    }
  }
}

export class Stacks {
  
  undoStack: {description: string, op: Operation}[] = [];
  redoStack: {description: string, op: Operation}[] = [];

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  hasUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  canUndo(): boolean {
    return this.undoStack.length > 0 && !this.undoStack[0].op.noUndo;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0 && !this.redoStack[0].op.noUndo;
  }

  undoTooltip(): string | undefined {
    let op0 = this.undoStack[0];
    if (op0) {
      if (op0.op.noUndo)
        return "Cannot undo";
      else
        return `Undo (${this.undoStack[0].description})`;
    } else {
      return "Nothing to undo";
    }
  }

  redoTooltip(): string | undefined {
    if (this.redoStack.length > 0) {
      return `Redo (${this.redoStack[0].description})`;
    } else {
      return "Nothing to redo";
    }
  }
}