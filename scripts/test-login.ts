import { loginUser } from '../src/lib/auth';

process.env.JWT_SECRET = 'aladin123';
process.env.JWT_REFRESH_SECRET = 'aladin456';

async function main() {
  // Test Admin login
  const admin = await loginUser('0901234567', 'aladin123');
  console.log('Admin:', admin.success ? `OK (${admin.data?.user?.role})` : `FAIL: ${admin.error?.message}`);

  // Test Shop Owner login
  const shopOwner = await loginUser('0901234600', 'aladin123');
  console.log('Shop Owner:', shopOwner.success ? `OK (${shopOwner.data?.user?.role})` : `FAIL: ${shopOwner.error?.message}`);

  // Test Sales Rep login
  const salesRep = await loginUser('0911111111', 'aladin123');
  console.log('Sales Rep:', salesRep.success ? `OK (${salesRep.data?.user?.role})` : `FAIL: ${salesRep.error?.message}`);

  // Test Driver login
  const driver = await loginUser('0922222222', 'aladin123');
  console.log('Driver:', driver.success ? `OK (${driver.data?.user?.role})` : `FAIL: ${driver.error?.message}`);

  // Test Broker login
  const broker = await loginUser('0933333333', 'aladin123');
  console.log('Broker:', broker.success ? `OK (${broker.data?.user?.role})` : `FAIL: ${broker.error?.message}`);

  // Test wrong password
  const wrong = await loginUser('0901234567', 'wrongpassword');
  console.log('Wrong PW:', !wrong.success ? `OK (rejected)` : `FAIL: should have rejected`);
}

main().then(() => process.exit(0));