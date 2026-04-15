import React from "react";
import { renderToString } from "react-dom/server";

import CountdownChip from "@/app/stages/_components/CountdownChip";

describe("CountdownChip", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the same initial markup even when server and client clocks differ", () => {
    const targetDate = "2026-04-18T09:00:00.000Z";

    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-04-09T09:00:00.000Z").getTime());
    const serverMarkup = renderToString(
      <CountdownChip targetDate={targetDate} label="avant le départ" tone="amber" />
    );

    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-04-11T09:00:00.000Z").getTime());
    const clientInitialMarkup = renderToString(
      <CountdownChip targetDate={targetDate} label="avant le départ" tone="amber" />
    );

    expect(clientInitialMarkup).toBe(serverMarkup);
  });
});
