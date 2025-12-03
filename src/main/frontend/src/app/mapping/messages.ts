import { Upgraded } from './mapping';
import { Codes } from './mapping-data';

/** Object to collect messages from running operations  */
export class Messages {
  private messages: Message[] = [];
  addNonEmpty(message: Message) {
    if (message.nonEmpty()) {
      this.messages.push(message);
    }
  }
  isNonEmpty() {
    return this.messages.length > 0;
  }
  hasWarnings() {
    return this.messages.some(w => w.isWarning());
  }
  allToString() {
    return this.messages.map((w) => w.toString()).join('\n\n');
  }
  warningsToString() {
    return this.messages.filter(w => w.isWarning()).map((w) => w.toString()).join('\n\n');
  }
}

export abstract class Message {
  abstract nonEmpty(): boolean;
  abstract isWarning(): boolean;
  abstract toString(): String;
}

export class UpgradedMessage {
  constructor(private upgraded: Upgraded) {}
  nonEmpty() {
    return Object.keys(this.upgraded).length > 0;
  }
  isWarning() {
    return false;
  }
  toString(): string {
    let message =
      'The following codes were previously custom codes, and are now regular codes:';
    for (let vocId of Object.keys(this.upgraded)) {
      message += `\n${vocId}`;
      for (let codeId of Object.keys(this.upgraded[vocId])) {
        message += `\n- ${codeId}`;
        let pair = this.upgraded[vocId][codeId];
        if (pair !== null) {
          message += ` (changed concept from ${pair[0]} to ${Array.from(
            pair[1]
          ).join(', ')})`;
        }
      }
    }
    message += "This means they were already used in the mapping, but become available in the new version of the coding system."
    return message;
  }
}

export class DowngradedMessage implements Message {
  constructor(private codes: Codes) {}
  nonEmpty() {
    return Object.keys(this.codes).length > 0;
  }
  isWarning() {
    return true;
  }
  toString() {
    let message =
      'The following codes were previously regular codes, are not available in the new version of the coding system, and are now custom codes:';
    for (let vocId of Object.keys(this.codes)) {
      message += `\n${vocId}`;
      for (let codeId of Object.keys(this.codes[vocId])) {
        message += `\n- ${codeId}`;
      }
    }
    message +=
      '\nThis might be due to an error in the coding system or an obsolete code';
    return message;
  }
}
