export const ServerNotFoundScreen = () => {
  return (
    <div
      className="bg-background fixed top-0 right-0 bottom-0 left-0 z-99999 flex h-screen items-center justify-center"
      data-component="not-found-screen"
      suppressHydrationWarning
    >
      <div>
        <h2 className="inline-block align-top text-[24px] leading-12.5 font-medium">
          404
        </h2>
        <p className="border-l-dim ml-5 inline-block border-l pl-5 align-middle text-sm leading-12.5 font-normal">
          This page could not be found.
        </p>
      </div>
    </div>
  );
};
