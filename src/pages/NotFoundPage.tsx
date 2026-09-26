import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="That page doesn’t exist. The network is this way."
      action={<Button variant="primary" onClick={() => navigate('/explore')}>Go to Explore</Button>}
    />
  );
}
