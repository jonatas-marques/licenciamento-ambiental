import createProjectNavigation from "interface/ProjectNavigation";

describe("interface/ProjectNavigation", () => {
  test("provides a link to the MCE overview inside its expandable menu", () => {
    const navigation = createProjectNavigation("project-id", "mce");
    const mceItem = navigation.items.find((item) => item.label === "MCE");
    const overviewLink = mceItem.children.find(
      (child) => child.label === "Visão geral",
    );

    expect(overviewLink.href).toBe("/projetos/project-id/mce");
    expect(overviewLink.current).toBe(true);
  });
});
