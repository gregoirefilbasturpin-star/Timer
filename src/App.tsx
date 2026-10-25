import { useRoute } from './hooks/useRoute';
import { EditorScreen } from './screens/EditorScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RunScreen } from './screens/RunScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  const route = useRoute();
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
