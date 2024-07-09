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

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ConceptId, Concept, VocabularyId, CodeId } from '../data';
import { TopicsInfo, ReviewData, ReviewOperation, NewTopic, NewMessage, ResolveTopic, MarkAsRead } from '../review';

@Component({
  selector: 'reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent {
  @Input() topicsInfo! : TopicsInfo;
  @Input() heading! : string;
  @Input() cui : ConceptId | null = null;
  @Input() voc : VocabularyId | null = null;
  @Input() code : CodeId | null = null;
  @Input() data! : ReviewData;
  @Input() userIsEditor! : boolean;
  @Output() run : EventEmitter<ReviewOperation> = new EventEmitter<ReviewOperation>();
  toggleTopicShowMessages(topicId : string) {
    this.data.topicShowMessages[topicId] = !this.data.topicShowMessages[topicId];
  }
  newTopic(heading : string) {
    if (heading) {
      this.run.emit(new NewTopic(this.cui, this.voc, this.code, heading, this.data));
    }
  }
  markAsRead(topicId : string) {
    this.run.emit(new MarkAsRead(parseInt(topicId)));
  }
  resolveTopic(topicId : string) {
    if (confirm("Mark this discussion as resolved and disable further messages?")) {
      this.run.emit(new ResolveTopic(parseInt(topicId), this.data));
    }
  }
  newMessage(topicId : string, content : string) {
    if (content) {
      this.run.emit(new NewMessage(parseInt(topicId), content, this.data))
    }
  }
  key() {
    return `${this.cui ?? "-"}/${this.voc ?? "-"}/${this.code ?? "-"}`
  }
}
