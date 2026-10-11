import React from "react";

export const ConditionalRender = ({
  condition,
  children,
}: {
  condition: boolean;
  children: React.ReactNode;
}) => {
  return condition ? (
    <React.Fragment>{children}</React.Fragment>
  ) : (
    <React.Fragment />
  );
};
