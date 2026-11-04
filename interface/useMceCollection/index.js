import { useEffect, useState } from "react";
import { useRouter } from "next/router";

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  return { response, body };
}

function toMessage(body) {
  return `${body.message} ${body.action}`.trim();
}

// Carrega os dados de uma coleção do MCE (fluxogramas, equipamentos, itens...).
// Não desenha nada: cada página usa o resultado para montar a sua tela.
// `extraCollections` são coleções auxiliares, somente leitura.
export default function useMceCollection(collection, extraCollections = []) {
  const router = useRouter();
  const projectId = router.query.id;
  const [projectName, setProjectName] = useState("");
  const [hasMce, setHasMce] = useState(false);
  const [items, setItems] = useState([]);
  const [extras, setExtras] = useState({});
  const [canEdit, setCanEdit] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const extraKey = extraCollections.join(",");

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return;
    }

    let isCurrentRequest = true;
    const baseUrl = `/api/v1/projects/${projectId}`;

    async function load() {
      try {
        const [project, members, user, mce] = await Promise.all([
          fetchJson(baseUrl),
          fetchJson(`${baseUrl}/members`),
          fetchJson("/api/v1/user"),
          fetchJson(`${baseUrl}/mce`),
        ]);

        for (const { response, body } of [project, members, user]) {
          if (!response.ok) {
            throw new Error(toMessage(body));
          }
        }

        let loadedItems = [];
        const loadedExtras = {};
        const mceExists = mce.response.ok;

        if (mceExists) {
          const list = await fetchJson(`${baseUrl}/mce/${collection}`);
          if (!list.response.ok) {
            throw new Error(toMessage(list.body));
          }
          loadedItems = list.body;

          for (const name of extraKey ? extraKey.split(",") : []) {
            const extra = await fetchJson(`${baseUrl}/mce/${name}`);
            if (!extra.response.ok) {
              throw new Error(toMessage(extra.body));
            }
            loadedExtras[name] = extra.body;
          }
        } else if (mce.response.status !== 404) {
          throw new Error(toMessage(mce.body));
        }

        if (isCurrentRequest) {
          const membership = members.body.find(
            (member) => member.user_id === user.body.id,
          );
          setProjectName(project.body.name);
          setCanEdit(["owner", "admin", "member"].includes(membership?.role));
          setHasMce(mceExists);
          setItems(loadedItems);
          setExtras(loadedExtras);
          setLoadingStatus("success");
        }
      } catch (error) {
        if (isCurrentRequest) {
          setErrorMessage(error.message || "Não foi possível carregar a tela.");
          setLoadingStatus("failure");
        }
      }
    }

    load();

    return () => {
      isCurrentRequest = false;
    };
  }, [router.isReady, projectId, collection, extraKey]);

  return {
    projectId,
    projectName,
    hasMce,
    items,
    setItems,
    extras,
    canEdit,
    loadingStatus,
    errorMessage,
  };
}
