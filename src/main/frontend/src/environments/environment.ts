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

export const environment = {
  name: "environment.ts",
  production: false,
  // apiUrl: 'https://app.vac4eu.org/codemapper-testing/rest',
  apiUrl: "http://localhost:8080/codemapper-testing/rest",
  defaultVocabularies: ["ICD10CM", "SNOMEDCT_US"],
  peregrineUrl: "https://app.vac4eu.org/peregrine-codemapper/rest"
  // apiUrl: "http://localhost:8080/codemapper-dev/rest",
};
