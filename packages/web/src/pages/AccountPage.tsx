import { useNavigate } from 'react-router-dom';
import { UserSettingsModal } from '../components/settings/user/UserSettingsModal.js';

export function AccountPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <UserSettingsModal onClose={() => navigate('/')} inline />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    paddingBottom: 56,
    background: 'var(--bg-primary)',
  },
};
