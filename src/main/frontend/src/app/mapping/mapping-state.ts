import { Caches, Mapping } from "./mapping";
import { Codes, Concepts, MappingData, Vocabularies } from "./mapping-data";
import { Operation } from "./operations";

export class MappingState {
  caches: Caches = new Caches({}, {});
  stacks: Stacks = new Stacks();

  constructor(public mapping: Mapping) {
    this.cacheAndCheck();
  }

  cacheAndCheck() {
    this.caches = this.mapping.caches();
    this.mapping = this.mapping.clone();
  }

  addMapping(data: MappingData) {
    this.mapping.addMapping(data);
    this.cacheAndCheck();
  }

  remap(
    umlsVersion: string,
    concepts: Concepts,
    codes: Codes,
    vocabularies: Vocabularies
  ) {
    this.mapping.remap(umlsVersion, concepts, codes, vocabularies, this.caches);
    this.cacheAndCheck();
  }

  runIntern(op: Operation) {
    let inv = op.run({mapping: this.mapping, caches: this.caches});
    this.cacheAndCheck();
    return inv;
  }

  public run(op: Operation) {
    console.log('Run', op);
    if (op.noUndo && this.stacks.hasUndo()) {
      alert('this operation cannot be undone, please save your mapping first');
      return;
    }
    let inv;
    try {
      inv = this.runIntern(op);
    } catch (err) {
      let msg = `could not run operation: ${(err as Error).message}`;
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

  public undo() {
    let op = this.stacks.undoStack.pop();
    if (op === undefined) return;
    console.log('Undo', op.description);
    let inv = this.runIntern(op.op);
    if (inv !== undefined) {
      this.stacks.redoStack.push({description: op.description, op: inv});
    }
  }

  public redo() {
    let op = this.stacks.redoStack.pop();
    if (op === undefined) return;
    console.log('Redo', op.description);
    let inv = this.runIntern(op.op);
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