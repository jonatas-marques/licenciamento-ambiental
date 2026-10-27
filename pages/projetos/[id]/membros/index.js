import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate, Card } from "@primer/react/experimental";
import { PencilIcon, TrashIcon } from "@primer/octicons-react";
import { useRouter } from "next/router";
import DefaultLayout from "../../../../interface/DefaultLayout";
import createProjectNavigation from "../../../../interface/ProjectNavigation";

export default function ProjectMembersPage() {
  const router = useRouter();
  const projectId = router.query.id;
  const [projectName, setProjectName] = useState("");
  const [members, setMembers] = useState([]);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [formValues, setFormValues] = useState({
    user_id: "",
    role: "member",
  });
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitErrorMessage, setSubmitErrorMessage] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingRole, setEditingRole] = useState("");
  const [membershipActionStatus, setMembershipActionStatus] = useState("idle");
  const [membershipActionError, setMembershipActionError] = useState(null);
  const [membershipActionSuccess, setMembershipActionSuccess] = useState(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;

    async function loadProjectMembers() {
      try {
        const [projectResponse, membersResponse, userResponse] =
          await Promise.all([
            fetch(`/api/v1/projects/${projectId}`),
            fetch(`/api/v1/projects/${projectId}/members`),
            fetch("/api/v1/user"),
          ]);
        const [projectBody, membersBody, userBody] = await Promise.all([
          projectResponse.json(),
          membersResponse.json(),
          userResponse.json(),
        ]);

        if (!projectResponse.ok) {
          throw new Error(
            `${projectBody.message} ${projectBody.action}`.trim(),
          );
        }
        if (!membersResponse.ok) {
          throw new Error(
            `${membersBody.message} ${membersBody.action}`.trim(),
          );
        }
        if (!userResponse.ok) {
          throw new Error(`${userBody.message} ${userBody.action}`.trim());
        }
        if (!Array.isArray(membersBody)) {
          throw new Error("A resposta da API possui um formato inválido.");
        }

        if (isCurrentRequest) {
          const currentMembership = membersBody.find(
            (member) => member.user_id === userBody.id,
          );
          setProjectName(projectBody.name);
          setMembers(membersBody);
          setCurrentUserId(userBody.id);
          setCurrentUserRole(currentMembership?.role);
          setCanManageMembers(
            ["owner", "admin"].includes(currentMembership?.role),
          );
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(
            error.message || "Não foi possível carregar os membros.",
          );
          setLoadingStatus("failure");
        }
      }
    }

    loadProjectMembers();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId]);

  function openAddMemberForm() {
    setFormValues({ user_id: "", role: "member" });
    setSubmitErrorMessage(null);
    setSubmitStatus("idle");
    setIsAddingMember(true);
  }

  async function handleAddMember(event) {
    event.preventDefault();
    setSubmitStatus("loading");
    setSubmitErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
          ...formValues,
        }),
      });
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      setMembers((currentMembers) => [...currentMembers, responseBody]);
      setIsAddingMember(false);
      setSubmitStatus("success");
    } catch (error) {
      setSubmitErrorMessage(
        error.message || "Não foi possível adicionar o membro.",
      );
      setSubmitStatus("failure");
    }
  }

  function startEditingMember(member) {
    setEditingMemberId(member.user_id);
    setEditingRole(member.role);
    setMembershipActionError(null);
    setMembershipActionSuccess(null);
  }

  async function handleUpdateMemberRole(member) {
    setMembershipActionStatus("loading");
    setMembershipActionError(null);
    setMembershipActionSuccess(null);

    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/members/${member.user_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: editingRole }),
        },
      );
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      setMembers((currentMembers) =>
        currentMembers.map((currentMember) =>
          currentMember.user_id === responseBody.user_id
            ? responseBody
            : currentMember,
        ),
      );
      if (responseBody.user_id === currentUserId) {
        setCurrentUserRole(responseBody.role);
        setCanManageMembers(["owner", "admin"].includes(responseBody.role));
      }
      setEditingMemberId(null);
      setMembershipActionSuccess("Papel do membro atualizado.");
      setMembershipActionStatus("success");
    } catch (error) {
      setMembershipActionError(
        error.message || "Não foi possível atualizar o papel do membro.",
      );
      setMembershipActionStatus("failure");
    }
  }

  async function handleRemoveMember(member) {
    const confirmed = window.confirm(
      `Tem certeza de que deseja remover ${member.user_id} do projeto?`,
    );
    if (!confirmed) {
      return;
    }

    setMembershipActionStatus("loading");
    setMembershipActionError(null);
    setMembershipActionSuccess(null);

    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/members/${member.user_id}`,
        { method: "DELETE" },
      );
      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `${responseBody.message} ${responseBody.action}`.trim(),
        );
      }

      setMembers((currentMembers) =>
        currentMembers.filter(
          (currentMember) => currentMember.user_id !== responseBody.user_id,
        ),
      );
      if (responseBody.user_id === currentUserId) {
        setCurrentUserRole(null);
        setCanManageMembers(false);
      }
      setEditingMemberId(null);
      setMembershipActionSuccess("Membro removido do projeto.");
      setMembershipActionStatus("success");
    } catch (error) {
      setMembershipActionError(
        error.message || "Não foi possível remover o membro.",
      );
      setMembershipActionStatus("failure");
    }
  }

  return (
    <DefaultLayout
      subNavigation={createProjectNavigation(projectId, "members")}
      metadata={{
        title: "Membros do projeto",
        description: "Consulte e gerencie os membros deste projeto",
      }}
    >
      <Stack gap="spacious">
        <div className="project-section-heading">
          {projectName && <Heading as="h1">{projectName}</Heading>}
          <Heading as="h2">Membros</Heading>
          {canManageMembers && (
            <Button
              variant="primary"
              onClick={() =>
                isAddingMember ? setIsAddingMember(false) : openAddMemberForm()
              }
              aria-expanded={isAddingMember}
            >
              Adicionar membro
            </Button>
          )}
        </div>

        {isAddingMember && (
          <Card>
            <form onSubmit={handleAddMember}>
              <Stack gap="normal">
                <Heading as="h3">Adicionar membro</Heading>
                <FormControl>
                  <FormControl.Label>ID do usuário</FormControl.Label>
                  <TextInput
                    value={formValues.user_id}
                    onChange={(event) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        user_id: event.target.value.trim(),
                      }))
                    }
                    placeholder="UUID da conta do usuário"
                    required
                    block
                    disabled={submitStatus === "loading"}
                  />
                  <FormControl.Caption>
                    Informe o UUID do usuário que já possui uma conta.
                  </FormControl.Caption>
                </FormControl>
                <FormControl>
                  <FormControl.Label>Papel no projeto</FormControl.Label>
                  <Select
                    value={formValues.role}
                    onChange={(event) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        role: event.target.value,
                      }))
                    }
                    block
                    disabled={submitStatus === "loading"}
                  >
                    <Select.Option value="member">Membro</Select.Option>
                    <Select.Option value="viewer">Leitor</Select.Option>
                    <Select.Option value="admin">Administrador</Select.Option>
                    {currentUserRole === "owner" && (
                      <Select.Option value="owner">Proprietário</Select.Option>
                    )}
                  </Select>
                </FormControl>
                {submitErrorMessage && (
                  <Banner
                    variant="critical"
                    title="Não foi possível adicionar"
                    description={submitErrorMessage}
                  />
                )}
                <div>
                  <Button
                    type="button"
                    onClick={() => setIsAddingMember(false)}
                    disabled={submitStatus === "loading"}
                  >
                    Cancelar
                  </Button>{" "}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submitStatus === "loading"}
                  >
                    {submitStatus === "loading"
                      ? "Adicionando..."
                      : "Adicionar"}
                  </Button>
                </div>
              </Stack>
            </form>
          </Card>
        )}

        {submitStatus === "success" && (
          <Banner
            title="Membro adicionado"
            description="O membro foi associado ao projeto."
          />
        )}
        {membershipActionError && (
          <Banner
            variant="critical"
            title="Não foi possível alterar o membro"
            description={membershipActionError}
          />
        )}
        {membershipActionSuccess && (
          <Banner
            title="Membros atualizados"
            description={membershipActionSuccess}
          />
        )}
        {loadingStatus === "loading" && <Text>Carregando membros...</Text>}
        {loadingStatus === "failure" && (
          <Banner
            variant="critical"
            title="Não foi possível carregar"
            description={errorMessage}
          />
        )}
        {loadingStatus === "success" && members.length === 0 && (
          <Blankslate border>
            <Blankslate.Heading>Nenhum membro encontrado</Blankslate.Heading>
          </Blankslate>
        )}
        {loadingStatus === "success" && members.length > 0 && (
          <Stack gap="normal">
            {members.map((member) => (
              <Card key={member.id}>
                <Card.Heading>{member.user_id}</Card.Heading>
                {editingMemberId === member.user_id ? (
                  <Stack gap="normal">
                    <FormControl>
                      <FormControl.Label>Papel no projeto</FormControl.Label>
                      <Select
                        value={editingRole}
                        onChange={(event) => setEditingRole(event.target.value)}
                        block
                        disabled={membershipActionStatus === "loading"}
                      >
                        <Select.Option value="member">Membro</Select.Option>
                        <Select.Option value="viewer">Leitor</Select.Option>
                        <Select.Option value="admin">
                          Administrador
                        </Select.Option>
                        {currentUserRole === "owner" && (
                          <Select.Option value="owner">
                            Proprietário
                          </Select.Option>
                        )}
                      </Select>
                    </FormControl>
                    <div>
                      <Button
                        type="button"
                        onClick={() => setEditingMemberId(null)}
                        disabled={membershipActionStatus === "loading"}
                      >
                        Cancelar
                      </Button>{" "}
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => handleUpdateMemberRole(member)}
                        disabled={
                          membershipActionStatus === "loading" ||
                          editingRole === member.role
                        }
                      >
                        Salvar papel
                      </Button>
                    </div>
                  </Stack>
                ) : (
                  <Card.Description>
                    Papel: {formatRole(member.role)}
                  </Card.Description>
                )}
                {canManageMembers &&
                  (member.role !== "owner" || currentUserRole === "owner") && (
                    <Card.Action>
                      {editingMemberId !== member.user_id && (
                        <>
                          <Button
                            type="button"
                            size="small"
                            leadingVisual={PencilIcon}
                            onClick={() => startEditingMember(member)}
                            disabled={membershipActionStatus === "loading"}
                          >
                            Alterar papel
                          </Button>{" "}
                          <Button
                            type="button"
                            size="small"
                            variant="danger"
                            leadingVisual={TrashIcon}
                            onClick={() => handleRemoveMember(member)}
                            disabled={membershipActionStatus === "loading"}
                          >
                            Remover
                          </Button>
                        </>
                      )}
                    </Card.Action>
                  )}
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </DefaultLayout>
  );
}

function formatRole(role) {
  const labels = {
    owner: "Proprietário",
    admin: "Administrador",
    member: "Membro",
    viewer: "Leitor",
  };

  return labels[role] || role;
}
