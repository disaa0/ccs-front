import { post } from 'aws-amplify/api';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';

export const logEvent = async (user: string, eventType: string, metadata: any): Promise<void> => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    await post({
      apiName: 'tul_ccs_api',
      path: '/log-event',
      options: {
        body: {
          user_id: user,
          event_type: eventType,
          metadata,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      }
    });
  } catch (err) {
    console.error("Error logging event:", err);
    throw err;
  }
};
