import { render, screen } from "@testing-library/react";

import { StagePanel } from "@/components/EAMPrep/StagePanel";

describe("EAM canonical Stage Commando panel", () => {
  it("renders the sprint inside the existing EAM module", () => {
    render(<StagePanel checks={{}} onToggleCheck={jest.fn()} onOpenModule={jest.fn()} />);

    expect(screen.getByRole("heading", { name: /Stage Commando 10h/i })).toBeInTheDocument();
    expect(screen.getByText(/Mission du jour/i)).toBeInTheDocument();
    expect(screen.getByText(/Protocole week-end/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("eam-stage-session-card")).toHaveLength(5);
  });

  it("stores stage validation with additive progress keys", () => {
    const onToggleCheck = jest.fn();
    render(<StagePanel checks={{}} onToggleCheck={onToggleCheck} onOpenModule={jest.fn()} />);

    screen.getByRole("checkbox", { name: /Séance S1 faite/i }).click();
    screen.getByRole("checkbox", { name: /Inter-séance S1 fait/i }).click();

    expect(onToggleCheck).toHaveBeenCalledWith("stage_S1_done");
    expect(onToggleCheck).toHaveBeenCalledWith("stage_S1_inter");
  });
});
