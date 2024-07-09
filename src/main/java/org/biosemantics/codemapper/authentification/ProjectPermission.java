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

package org.biosemantics.codemapper.authentification;

public enum ProjectPermission {
  Admin,
  Editor,
  Commentator;

  public static ProjectPermission fromString(String c) {
    switch (c) {
      case "A":
        return Admin;
      case "E":
        return Editor;
      case "C":
        return Commentator;
      default:
        return null;
    }
  }

  public boolean implies(ProjectPermission perm) {
    switch (this) {
      case Admin:
        return perm.equals(Admin) || perm.equals(Editor) || perm.equals(Commentator);
      case Editor:
        return perm.equals(Editor) || perm.equals(Commentator);
      case Commentator:
        return perm.equals(Commentator);
    }
    return false;
  }
}
