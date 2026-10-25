import { ErrorBoundary } from './components/MessageScreen';
import { useRoute, type Route } from './hooks/useRoute';
import { EditorScreen } from './screens/EditorScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RunScreen } from './screens/RunScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'edit':
      return <EditorScreen key={route.id} id={route.id} />;
    case 'run':
      return <RunScreen key={route.id ?? 'resume'} workoutId={route.id} />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <HomeScreen />;
  }
}

export function App() {
  const route = useRoute();
  const key = route.name === 'edit' || route.name === 'run' ? `${route.name}/${route.id ?? ''}` : route.name;
  return (
    <ErrorBoundary key={key}>
      <Screen route={route} />
    </ErrorBoundary>
  );
}
