// This file is part of CodeMapper.
//
// Copyright 2022-2024 VAC4EU - Vaccine monitoring Collaboration for Europe.
// Copyright 2017-2021 Erasmus Medical Center, Department of Medical Informatics.
//
// CodeMapper is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option) any
// later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import { Observable, firstValueFrom, map, merge, of } from 'rxjs';
import { ConceptId, VocabularyId, CodeId, MappingData } from './mapping-data';
import { ApiService } from './api.service';
import { User } from './auth.service';

// store of review form data across reloads
export class ReviewData {
  constructor(
    public newTopicHeading : { [key : string] : string } = {},
    public newMessageText : { [key : string] : string } = {},
    public topicShowMessages : { [key : string] : boolean } = {},
  ) { }
}

export interface Action {
  user : string | null;
  timestamp : string;
}

export interface Message {
  id : number;
  username : string | null;
  timestamp : string;
  content : string;
  isRead : boolean;
  hasNewline : boolean;
}

export interface Topic {
  id : string;
  numMessages : number,
  numNewMessages : number,
  heading : string;
  created : Action;
  resolved : Action | null;
  messages : Message[];
}

export class TopicsInfo {
  constructor(
    public topics : { [key : number] : Topic } = {},
    public numMessages : number = 0,
    public numNewMessages : number = 0,
  ) { }

  public numTopics() : number {
    return Object.keys(this.topics).length;
  }

  public tooltip() : string {
    const newSnippet = this.numNewMessages > 0 ? `, ${this.numNewMessages} new` : "";
    let s1 = this.numTopics() == 1 ? "" : "s";
    let s2 = this.numMessages == 1 ? "" : "s";
    return `Review concept (${this.numTopics()} topic${s1}, `
      + `${this.numMessages} comment${s2}${newSnippet})`;
  }

  public toRaw() : Topics0 {
    return this.topics;
  }

  public static fromRaw(topics0 : Topics0, me : string | null) : TopicsInfo {
    var cuiNumMessages = 0;
    var cuiNumNewMessages = 0;
    let topics = Object.fromEntries(
      Object.entries(topics0)
        .map(([topicId, topic]) => {
          let numMessages = 0;
          let numNewMessages = 0;
          let messages = topic.messages.map((message) => {
            let hasNewline = /\r|\n/.exec(message.content) != null;
            let isRead = topic.resolved != null || message.isRead;
            numMessages += 1;
            if (!isRead) {
              numNewMessages += 1;
            }
            let username = message.username;
            return { ...message, username, hasNewline, isRead }
          });
          cuiNumMessages += numMessages;
          cuiNumNewMessages += numNewMessages;
          return [topicId, {
            id: topicId,
            numMessages,
            numNewMessages,
            messages: messages,
            heading: topic.heading,
            created: topic.created,
            resolved: topic.resolved
          }];
        })
    );
    return new TopicsInfo(
      topics,
      cuiNumMessages,
      cuiNumNewMessages,
    );
  }
}

export type TopicsByConcept = { [key : ConceptId] : TopicsInfo };

export type TopicsByCode = { [key : VocabularyId] : { [key : CodeId] : TopicsInfo } };

export class AllTopics {
  constructor(
    public byConcept : TopicsByConcept = {},
    public byCode : TopicsByCode = {},
    public general : TopicsInfo = new TopicsInfo(),
  ) { }

  public setConcepts(conceptIds : ConceptId[]) {
    for (let id of conceptIds) {
      this.byConcept[id] ??= new TopicsInfo();
    }
  }

  public isEmpty() {
    return Object.keys(this.general).length == 0
      && Object.values(this.byConcept).every(t => Object.keys(t).length == 0)
      && Object.values(this.byCode).every(byCode => Object.values(byCode).every(t => Object.keys(t).length == 0));
  }

  public static fromRaw(allTopics : AllTopics0, me : string | null, cuis : ConceptId[]) : AllTopics {
    let byConcept = Object.fromEntries(
      Object.entries(allTopics.byConcept)
        .map(([cui, topics]) => [cui, TopicsInfo.fromRaw(topics, me)])
    );
    for (let cui of cuis) {
      byConcept[cui] ??= new TopicsInfo();
    }
    let byCode = Object.fromEntries(
      Object.entries(allTopics.byCode)
        .map(([voc, byCode]) =>
          [voc, Object.fromEntries(
            Object.entries(byCode)
              .map(([code, topics]) => [code, TopicsInfo.fromRaw(topics, me)])
          )])
    );
    let general = TopicsInfo.fromRaw(allTopics.general, me);
    return new AllTopics(byConcept, byCode, general);
  }

  public toRaw() : AllTopics0 {
    let byConcept = Object.fromEntries(
      Object.entries(this.byConcept)
        .map(([id, topics]) => [id, topics.toRaw()])
    );
    let byCode = Object.fromEntries(
      Object.entries(this.byCode)
        .map(([voc, byCode]) => [voc, Object.fromEntries(
          Object.entries(byCode)
            .map(([code, topics]) => [code, topics.toRaw()])
        )])
    );
    let general = this.general.toRaw();
    return { byConcept, byCode, general };
  }
}

export type Topics0 = { [key : number] : Topic }

export type AllTopics0 = {
  byConcept : { [key : ConceptId] : Topics0 },
  byCode : { [key : VocabularyId] : { [key : CodeId] : Topics0 } },
  general : Topics0,
}

export interface ReviewOperation {
  run(api : ApiService, mappingShortkey : string) : Observable<Object>;
}

export class Refresh implements ReviewOperation {
  run(api : ApiService, mappingShortkey : string) : Observable<Object> {
    return of({});
  }
}

export class NewTopic implements ReviewOperation {
  constructor(
    private cui : ConceptId | null,
    private sab : VocabularyId | null,
    private code : CodeId | null,
    private content : string,
    private data : ReviewData,
  ) { }
  run(api : ApiService, mappingShortkey : string) : Observable<Object> {
    return api.newTopic(mappingShortkey, this.cui, this.sab, this.code, this.content)
      .pipe(map(id => this.data.topicShowMessages[id] = true));
  }
}

export class NewMessage implements ReviewOperation {
  constructor(
    private topicId : number,
    private content : string,
    private data : ReviewData,
  ) { }
  run(api : ApiService, mappingShortkey : string) : Observable<Object> {
    return api.newMessage(mappingShortkey, this.topicId, this.content)
      .pipe(map(_ => this.data.newMessageText[this.topicId] = ""))
  }
}

export class MarkAsRead implements ReviewOperation {
  constructor(private topicId : number) { }
  run(api : ApiService, mappingShortkey : string) : Observable<Object> {
    return api.markAsRead(mappingShortkey, this.topicId)
  }
}

export class ResolveTopic implements ReviewOperation {
  constructor(
    private topicId : number,
    private data : ReviewData,
  ) { }
  run(api : ApiService, mappingShortkey : string) : Observable<Object> {
    return merge(
      api.markAsRead(mappingShortkey, this.topicId),
      api.resolveTopic(mappingShortkey, this.topicId)
    ).pipe(map(_ => this.data.topicShowMessages[this.topicId] = false))
  }
}

export class EditMessage implements ReviewOperation {
  constructor(
    private topicId : number,
    private messageId : number,
    private content : string,
  ) { }
  run(api : ApiService, mappingShortkey : string) : Observable<Object> {
    return api.editMessage(mappingShortkey, this.topicId, this.messageId, this.content);
  }
}
