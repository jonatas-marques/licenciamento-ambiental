export default function createProjectNavigation(projectId, currentSection) {
  if (typeof projectId !== "string") {
    return null;
  }

  const projectPath = `/projetos/${projectId}`;
  const sections = [
    { id: "project", label: "Projeto", href: projectPath },
    { id: "members", label: "Membros", href: `${projectPath}/membros` },
    { id: "parties", label: "Partes", href: `${projectPath}/partes` },
    { id: "mce", label: "MCE", href: `${projectPath}/mce` },
    {
      id: "settings",
      label: "Configurações",
      href: `${projectPath}/configuracoes`,
    },
  ];

  return {
    ariaLabel: "Seções do projeto",
    items: sections.map((section) => ({
      label: section.label,
      href: section.href,
      current: section.id === currentSection,
    })),
  };
}
