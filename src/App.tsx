import { Desktop } from './components/layout/Desktop';
import { SiteContentProvider } from './content/siteContent';
import { ShareProvider } from './share/ShareProvider';

function App() {
  return (
    <SiteContentProvider>
      <ShareProvider>
        <Desktop />
      </ShareProvider>
    </SiteContentProvider>
  );
}

export default App;
