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

import { Component, Input, Output, EventEmitter, TemplateRef } from '@angular/core';
import { ConceptId, VocabularyId, CodeId } from '../data';
import { TopicsInfo, ReviewData, ReviewOperation, NewTopic, NewMessage, EditMessage, ResolveTopic, MarkAsRead } from '../review';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../auth.service';

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
  username : string | null = null;
  editMessage : { content : string, topicId : string, messageId : number } | null = null;
  constructor(
    private dialog : MatDialog,
    private auth : AuthService,
  ) {
    this.auth.userSubject.subscribe(u => this.username = u?.username ?? null);
  }
  toggleTopicShowMessages(topicId : string) {
    this.data.topicShowMessages[topicId] = !this.data.topicShowMessages[topicId];
  }
  newTopic(key : string) {
    let heading = this.data.newTopicHeading[key];
    if (heading) {
      this.run.emit(new NewTopic(this.cui, this.voc, this.code, heading, this.data));
      this.data.newTopicHeading[key] = "";
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

  openEditMessageDialog(templateRef : TemplateRef<any>, topicId : string, messageId : number, content : string) {
    this.editMessage = { content, topicId, messageId };
    this.dialog.open(templateRef, {
      width: '700px'
    });
  }
  cancelEditMessage() {
    this.editMessage = null;
  }
  saveEditMessage() {
    if (this.editMessage) {
      this.run.emit(new EditMessage(parseInt(this.editMessage.topicId), this.editMessage.messageId, this.editMessage.content));
      this.editMessage = null;
    }
  }
  displayUsername(username : string | null) {
    if (username) {
      if (username == this.username) {
        return "me";
      } else {
        return username;
      }
    } else {
      return "(unknown)"
    }
  }
}
