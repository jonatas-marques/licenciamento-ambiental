import Head from "next/head";
import { useEffect, useState } from "react";
import {
  PageLayout,
  Header,
  Text,
  ActionMenu,
  ActionList,
} from "@primer/react";

import {
  OrganizationIcon,
  PersonIcon,
  SignOutIcon,
} from "@primer/octicons-react";
import Link from "next/link";
import styles from "./index.module.css";

const contentWidthClasses = {
  small: styles.smallContent,
};

export default function DefaultLayout({
  children,
  metadata = {},
  contentWidth,
}) {
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const extraContentClassName = contentWidthClasses[contentWidth];

  useEffect(() => {
    loadCurrentUser();
  }, []);
  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/v1/user");
      if (!response.ok) {
        return;
      }
      const userData = await response.json();
      setUser(userData);
    } catch {
      // usuário não logado
    } finally {
      setIsLoadingUser(false);
    }
  }

  async function handleLogout() {
    try {
      const response = await fetch("/api/v1/sessions", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Falha ao encerrar sessão.");
      }
      window.location.href = "/";
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <Head>
        <title>
          {metadata.title ? `${metadata.title} · EcoTab` : "EcoTab"}
        </title>

        {metadata.description && (
          <meta name="description" content={metadata.description} />
        )}
      </Head>

      <Header>
        <Header.Item full>
          <Header.Link href="/">EcoTab</Header.Link>
        </Header.Item>

        {!isLoadingUser && !user && (
          <>
            <Header.Item>
              <Header.Link href="/login">Login</Header.Link>
            </Header.Item>
            <Header.Item>
              <Header.Link href="/cadastro">Cadastrar</Header.Link>
            </Header.Item>
          </>
        )}

        {!isLoadingUser && user && (
          // Tentar substituir o botão pelo avatar
          <>
            <Header.Item>
              <ActionMenu>
                <ActionMenu.Button>Usuário</ActionMenu.Button>

                <ActionMenu.Overlay>
                  <ActionList>
                    <ActionList.LinkItem as={Link} href="/perfil">
                      <PersonIcon size={16} />
                      Perfil
                    </ActionList.LinkItem>
                    <ActionList.LinkItem as={Link} href="/organizacao">
                      <OrganizationIcon size={16} />
                      Organização
                    </ActionList.LinkItem>
                    <ActionList.Item variant="danger" onSelect={handleLogout}>
                      <SignOutIcon size={16} />
                      Sair
                    </ActionList.Item>
                  </ActionList>
                </ActionMenu.Overlay>
              </ActionMenu>
            </Header.Item>
          </>
        )}
      </Header>

      <PageLayout>
        <PageLayout.Content
          width={contentWidth}
          className={extraContentClassName}
        >
          {children}
        </PageLayout.Content>
        <PageLayout.Footer divider="line">
          <Text size="small"> © {new Date().getFullYear()} EcoTab</Text>
        </PageLayout.Footer>
      </PageLayout>
    </>
  );
}
