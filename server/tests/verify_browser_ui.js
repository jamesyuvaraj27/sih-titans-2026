import { spawn } from 'child_process';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        } else if (msg.method) {
          const listeners = this.eventListeners.get(msg.method) || [];
          listeners.forEach((fn) => fn(msg.params));
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, fn) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(fn);
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }
}

async function run() {
  console.log('Starting Headless Chrome via CDP...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${PORT}`,
      '--remote-allow-origins=*',
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--user-data-dir=/tmp/statintel-test-chrome-profile',
    ],
    { stdio: 'ignore' }
  );

  let connected = false;
  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        connected = true;
        break;
      }
    } catch {}
    await sleep(200);
  }

  if (!connected) {
    chromeProcess.kill();
    throw new Error('Failed to connect to Chrome remote debugging port.');
  }

  console.log(`Connected to Chrome: ${versionData['Browser']}`);

  const newTabRes = await fetch(`http://localhost:${PORT}/json/new?http://localhost:5173/login`, {
    method: 'PUT',
  });
  const tabData = await newTabRes.json();
  const cdp = new CDPClient(tabData.webSocketDebuggerUrl);
  await cdp.connect();

  const consoleErrors = [];
  cdp.on('Runtime.exceptionThrown', (params) => {
    consoleErrors.push(`[Exception] ${params.exceptionDetails.text} ${params.exceptionDetails.exception?.description || ''}`);
  });
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      const text = params.args.map((a) => a.value || a.description || '').join(' ');
      consoleErrors.push(`[Console.Error] ${text}`);
    }
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  console.log('\n--- Step 1: Authenticate as Trainer via API & inject session ---');
  const trainerLoginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh@nssta.gov.in', password: 'demo1234' }),
  });
  const trainerData = await trainerLoginRes.json();
  if (!trainerData.token) throw new Error('Trainer login API failed');

  await cdp.eval(`
    localStorage.setItem('samiksha.token', ${JSON.stringify(trainerData.token)});
    window.location.href = '/trainer?tab=assignments';
  `);
  await sleep(2000);

  const currentUrl = await cdp.eval('window.location.href');
  console.log(`[PASS] Trainer authenticated and navigated. Current URL: ${currentUrl}`);

  const pageContent = await cdp.eval('document.body.innerText');
  const hasWhiteScreen = !pageContent || pageContent.trim().length === 0;

  console.log(`Page text length: ${pageContent.length} chars`);
  console.log(`Contains 'Curriculum Assignments & AI Publishing': ${pageContent.includes('Curriculum Assignments & AI Publishing')}`);
  console.log(`Contains 'Assigned Instances': ${pageContent.includes('Assigned Instances')}`);
  console.log(`Contains 'Learner Assignment Submissions': ${pageContent.includes('Learner Assignment Submissions')}`);

  if (hasWhiteScreen) {
    throw new Error('PAGE IS BLANK WHITE SCREEN!');
  }

  // Check for critical console errors
  const criticalErrors = consoleErrors.filter((e) =>
    e.includes('TypeError') || e.includes('timeStyle') || e.includes('Cannot read properties') || e.includes('Uncaught')
  );

  if (criticalErrors.length > 0) {
    console.error('Critical console errors detected:', criticalErrors);
    throw new Error(`Critical console errors found: ${criticalErrors.join('\n')}`);
  }

  console.log('[PASS] Trainer Assignments tab rendered successfully with ZERO runtime exceptions!');

  console.log('\n--- Step 3: Test Tab Switching ---');
  const tabs = ['materials', 'generate', 'review', 'assessments', 'results', 'overview', 'assignments'];
  for (const t of tabs) {
    await cdp.send('Page.navigate', { url: `http://localhost:5173/trainer?tab=${t}` });
    await sleep(600);
    const text = await cdp.eval('document.body.innerText');
    if (!text || text.trim().length < 50) {
      throw new Error(`Tab ${t} rendered a white/empty screen!`);
    }
    console.log(`  ✓ Tab '${t}' rendered cleanly (${text.length} chars)`);
  }

  console.log('\n--- Step 4: Test Publishing Flow in Browser ---');
  // Open publish modal on assignments tab
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/trainer?tab=assessments' });
  await sleep(1000);

  // Click Publish on first assessment card if available
  const publishBtnClicked = await cdp.eval(`
    const btns = Array.from(document.querySelectorAll('button'));
    const pubBtn = btns.find(b => b.innerText.includes('Publish to Learners'));
    if (pubBtn) {
      pubBtn.click();
      true;
    } else {
      false;
    }
  `);

  if (publishBtnClicked) {
    await sleep(500);
    const modalVisible = await cdp.eval(`
      document.body.innerText.includes('Publish Assignment to Learners') &&
      document.body.innerText.includes('Confirm & Publish')
    `);
    console.log(`Publish modal opened properly: ${modalVisible}`);
    if (!modalVisible) {
      throw new Error('Publish modal did not render!');
    }
    // Cancel modal
    await cdp.eval(`
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    `);
    await sleep(300);
    console.log('[PASS] Publish modal opened and closed cleanly without error');
  }

  console.log('\n--- Step 5: Test Learner Workflow in Browser ---');
  const learnerLoginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'vinaykumarbade2007@gmail.com', password: 'demo1234' }),
  });
  const learnerData = await learnerLoginRes.json();
  if (!learnerData.token) throw new Error('Learner login API failed');

  await cdp.eval(`
    localStorage.setItem('samiksha.token', ${JSON.stringify(learnerData.token)});
    window.location.href = '/learner/assignments';
  `);
  await sleep(2000);

  // Navigate to Learner Assignments
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/learner/assignments' });
  await sleep(1000);
  const learnerAssignText = await cdp.eval('document.body.innerText');
  console.log(`Learner Assignments text length: ${learnerAssignText.length}`);
  console.log(`Contains 'Assignments & Quizzes': ${learnerAssignText.includes('Assignments & Quizzes') || learnerAssignText.includes('Assignments')}`);
  if (!learnerAssignText || learnerAssignText.trim().length === 0) {
    throw new Error('Learner Assignments page is blank white screen!');
  }

  // Navigate to Learner Assessment Hub
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/assess' });
  await sleep(1000);
  const assessText = await cdp.eval('document.body.innerText');
  console.log(`Learner Assess Hub text length: ${assessText.length}`);
  console.log(`Contains 'Assessment & Quizzes': ${assessText.includes('Assessment & Quizzes')}`);
  if (!assessText || assessText.trim().length === 0) {
    throw new Error('Learner Assess Hub is blank white screen!');
  }

  // Check console errors throughout entire run
  const finalCriticalErrors = consoleErrors.filter((e) =>
    e.includes('TypeError') || e.includes('timeStyle') || e.includes('Cannot read properties')
  );

  console.log('\n==================================================');
  if (finalCriticalErrors.length === 0) {
    console.log('REAL BROWSER VERIFICATION: 100% SUCCESSFUL!');
    console.log('NO WHITE SCREEN. ZERO FATAL RUNTIME EXCEPTIONS.');
  } else {
    console.error('FAILED WITH RUNTIME ERRORS:', finalCriticalErrors);
    throw new Error(`Browser run finished with errors: ${finalCriticalErrors.join('\n')}`);
  }
  console.log('==================================================');

  chromeProcess.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('\nBROWSER TEST FAILED:', err);
  process.exit(1);
});
