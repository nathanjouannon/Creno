import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no canvas; axe probes it (icon ligatures) and logs a "not implemented" error each time
HTMLCanvasElement.prototype.getContext = () => null;
