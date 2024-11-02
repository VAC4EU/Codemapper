package org.biosemantics.codemapper.rest;

import java.util.Random;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

@Provider
public class InternalErrorExceptionMapper implements ExceptionMapper<InternalServerErrorException> {
  @Override
  public Response toResponse(InternalServerErrorException e) {
    String id = randomID(11);
    String message = String.format("%s (%s)", e.getMessage(), id);
    System.err.println("ERROR " + message);
    e.printStackTrace();
    return Response.status(e.getResponse().getStatus())
        .entity(
            "Sorry, something went wrong. To help us, please report what you did and the following error message and ID: "
                + message
                + ".")
        .type(MediaType.TEXT_PLAIN)
        .build();
  }

  String randomID(int length) {
    int leftLimit = 48; // numeral '0'
    int rightLimit = 122; // letter 'z'
    return new Random()
        .ints(leftLimit, rightLimit + 1)
        .filter(i -> (i <= 57 || i >= 65) && (i <= 90 || i >= 97))
        .limit(length)
        .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
        .toString();
  }
}
