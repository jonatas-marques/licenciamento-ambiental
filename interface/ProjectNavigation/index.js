import {
  FileIcon,
  GearIcon,
  PeopleIcon,
  RepoIcon,
  ToolsIcon,
  WorkflowIcon,
} from "@primer/octicons-react";

export default function createProjectNavigation(projectId, currentSection) {
  if (typeof projectId !== "string") {
    return null;
  }

  const projectPath = `/projetos/${projectId}`;
  const sections = [
    { id: "project", label: "Projeto", icon: RepoIcon, href: projectPath },
    {
      id: "members",
      label: "Membros",
      icon: PeopleIcon,
      href: `${projectPath}/membros`,
    },
    {
      id: "mce",
      label: "MCE",
      icon: FileIcon,
      href: `${projectPath}/mce`,
      children: [
        {
          id: "flowcharts",
          label: "Fluxogramas",
          icon: WorkflowIcon,
          href: `${projectPath}/mce/fluxogramas`,
        },
        {
          id: "equipments",
          label: "Equipamentos",
          icon: ToolsIcon,
          href: `${projectPath}/mce/equipamentos`,
        },
      ],
    },
    {
      id: "settings",
      label: "Configurações",
      icon: GearIcon,
      href: `${projectPath}/configuracoes`,
    },
  ];

  return {
    ariaLabel: "Seções do projeto",
    items: sections.map((section) => ({
      label: section.label,
      icon: section.icon,
      href: section.href,
      current: section.id === currentSection,
      children: section.children?.map((child) => ({
        label: child.label,
        icon: child.icon,
        href: child.href,
        current: child.id === currentSection,
      })),
    })),
  };
}
