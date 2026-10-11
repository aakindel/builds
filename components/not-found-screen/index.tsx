import React from "react";
import { ClientNotFoundScreen } from "./client";
import { ServerNotFoundScreen } from "./server";

export const NotFoundScreen = () => {
  return (
    <React.Fragment>
      <ClientNotFoundScreen />
      <ServerNotFoundScreen />
    </React.Fragment>
  );
};
