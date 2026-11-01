import { AppShell, Box, Button, Group, NavLink, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppData } from './components/AppData';
import { EmptyState, LoadError, Loading } from './components/LoadState';
import { NavContext, useNav, type Nav } from './components/Nav';
import { ThemeSwitch } from './components/ThemeSwitch';
import { Aktarim } from './features/aktarim/Aktarim';
import { TaskDrawer } from './features/detay/TaskDrawer';
import { Karsilastirma } from './features/karsilastirma/Karsilastirma';
import { Liste } from './features/liste/Liste';
import { Ozet } from './features/ozet/Ozet';
import { Pano } from './features/pano/Pano';
import { useRoute, type View } from './lib/route';

const VIEW_TITLES: Record<View, string> = {
  ozet: 'Özet',
  liste: 'Liste',
  pano: 'Pano',
  karsilastirma: 'Karşılaştırma',
  aktarim: 'İçe / Dışa Aktar',
};

const VIEW_ICONS: Record<View, string> = {
  ozet: '▦',
  liste: '☰',
  pano: '▥',
  karsilastirma: '⇄',
  aktarim: '⇅',
};

/** Görev listesine dayanan ekranlar için ortak yükleniyor / hata / boş kapısı. */
function TasksGate({ children, needsTasks }: { children: ReactNode; needsTasks: boolean }) {
  const { status, tasks, reload } = useAppData();
  const { go } = useNav();
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <LoadError onRetry={() => void reload()} />;
  if (needsTasks && tasks.length === 0)
    return (
      <EmptyState
        title="Henüz iş yok"
        text="Excel listenizi içe aktararak başlayın."
        action={<Button onClick={() => go('aktarim')}>İçe aktar</Button>}
      />
    );
  return <>{children}</>;
}

function SearchBox({ onSearch }: { onSearch: () => void }) {
  const { filters, setFilters } = useAppData();
  const [text, setText] = useState(filters.q);
  useEffect(() => setText(filters.q), [filters.q]);
  useEffect(() => {
    if (text === filters.q) return;
    const h = setTimeout(() => {
      setFilters((f) => ({ ...f, q: text }));
      onSearch();
    }, 200);
    return () => clearTimeout(h);
  }, [text, filters.q, setFilters, onSearch]);
  return (
    <TextInput
      type="search"
      aria-label="Ara"
      placeholder="Ara: konu, açıklama, OPM no…"
      value={text}
      onChange={(e) => setText(e.currentTarget.value)}
      w={320}
    />
  );
}

export function App() {
  const { route, go } = useRoute();
  const { status } = useAppData();

  const nav = useMemo<Nav>(
    () => ({
      view: route.view,
      go: (v) => go(v),
      openTask: (id) => go(route.view, id),
    }),
    [route.view, go],
  );

  const onSearch = useMemo(
    () => () => {
      if (route.view !== 'liste' && route.view !== 'pano') go('liste');
    },
    [route.view, go],
  );

  const screen: Record<View, ReactNode> = {
    ozet: (
      <TasksGate needsTasks>
        <Ozet />
      </TasksGate>
    ),
    liste: (
      <TasksGate needsTasks>
        <Liste />
      </TasksGate>
    ),
    pano: (
      <TasksGate needsTasks>
        <Pano />
      </TasksGate>
    ),
    karsilastirma: (
      <TasksGate needsTasks={false}>
        <Karsilastirma />
      </TasksGate>
    ),
    aktarim: (
      <TasksGate needsTasks={false}>
        <Aktarim />
      </TasksGate>
    ),
  };

  return (
    <NavContext.Provider value={nav}>
      <AppShell navbar={{ width: 220, breakpoint: 0 }} header={{ height: 60 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Title order={1} size="h3">
              {VIEW_TITLES[route.view]}
            </Title>
            <Group gap="sm">
              <SearchBox onSearch={onSearch} />
              <Button onClick={() => go(route.view, 'new')} disabled={status !== 'ready'}>
                + Yeni İş
              </Button>
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="sm">
          <Stack justify="space-between" h="100%">
            <Box>
              <Group gap="xs" mb="md" px="xs">
                <ThemeIcon size="lg" radius="md">
                  ✓
                </ThemeIcon>
                <Box>
                  <Text fw={700}>PolTask</Text>
                  <Text size="xs" c="dimmed">
                    Linktera iş takibi
                  </Text>
                </Box>
              </Group>
              <nav aria-label="Ana menü">
                {(Object.keys(VIEW_TITLES) as View[]).map((v) => (
                  <NavLink
                    key={v}
                    href={`#/${v}`}
                    label={VIEW_TITLES[v]}
                    leftSection={<span aria-hidden>{VIEW_ICONS[v]}</span>}
                    active={route.view === v}
                    onClick={(e) => {
                      e.preventDefault();
                      go(v);
                    }}
                  />
                ))}
              </nav>
            </Box>
            <ThemeSwitch />
          </Stack>
        </AppShell.Navbar>
        <AppShell.Main>{screen[route.view]}</AppShell.Main>
      </AppShell>
      {status === 'ready' && route.taskId !== null && (
        <TaskDrawer
          key={String(route.taskId)}
          taskId={route.taskId}
          onClose={() => go(route.view)}
          onCreated={(id) => go(route.view, id)}
        />
      )}
    </NavContext.Provider>
  );
}
