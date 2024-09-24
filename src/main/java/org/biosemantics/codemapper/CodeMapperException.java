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

package org.biosemantics.codemapper;

import javax.ws.rs.BadRequestException;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response.Status.Family;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class CodeMapperException extends Exception {

  private static Logger logger = LogManager.getLogger(CodeMapperException.class);

  private Family errorFamily;

  public String toString() {
    String res = this.getMessage();
    Throwable cause = this.getCause();
    if (cause != null) {
      res += " (" + cause.getMessage() + ")";
    }
    return res;
  }

  private CodeMapperException(Family errorFamily, String msg) {
    super(msg);
    this.errorFamily = errorFamily;
    this.printStackTrace();
  }

  private CodeMapperException(Family errorFamily, String msg, Exception e) {
    super(msg, e);
    this.errorFamily = errorFamily;
    this.printStackTrace();
  }

  private CodeMapperException(Family errorFamily, Exception e) {
    super(e);
    this.errorFamily = errorFamily;
    this.printStackTrace();
  }

  public static CodeMapperException user(String msg) {
    logger.error("CLIENT: " + msg);
    return new CodeMapperException(Family.CLIENT_ERROR, msg);
  }

  public static CodeMapperException user(String msg, Exception e) {
    logger.error("CLIENT: " + msg + ": " + e);
    return new CodeMapperException(Family.CLIENT_ERROR, msg, e);
  }

  public static CodeMapperException server(String msg, Exception e) {
    logger.error("SERVER: " + msg + ": " + e);
    return new CodeMapperException(Family.SERVER_ERROR, msg, e);
  }

  public static CodeMapperException server(String msg) {
    logger.error("SERVER: " + msg);
    return new CodeMapperException(Family.SERVER_ERROR, msg);
  }

  public WebApplicationException asWebApplicationException() {
    Throwable cause;
    switch (errorFamily) {
      case CLIENT_ERROR:
        logger.error(this);
        cause = getCause();
        if (cause != null) {
          getCause().printStackTrace();
        }
        return new BadRequestException(getMessage(), getCause());
      case SERVER_ERROR:
        logger.error(this);
        cause = getCause();
        if (cause != null) {
          getCause().printStackTrace();
        }
        return new InternalServerErrorException(getMessage(), getCause());
      default:
        throw new RuntimeException(
            "Error family neither client nor server: " + errorFamily + ": " + this);
    }
  }

  private static final long serialVersionUID = 1L;
}
