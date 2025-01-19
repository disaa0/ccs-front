'use client';

import { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { post } from 'aws-amplify/api';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Trash2, LogOut } from 'lucide-react';
import { amplifyConfig } from '@/amplifyconfiguration';
import { getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth';
import { getUrl, uploadData, remove, list } from 'aws-amplify/storage';

Amplify.configure(amplifyConfig);

const BASE_PATH = 'public';

type ListOutputItem = {
  key: string;
};

export default function Dashboard() {
  const [files, setFiles] = useState<ListOutputItem[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const router = useRouter();

  const getUserPath = (user: string): string => `${BASE_PATH}/${user}`;
  const getFilePath = (user: string, filename: string): string => `${user}/${filename}`;

  const checkAuth = async (): Promise<void> => {
    try {
      // const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const user = session.identityId || "";
      setUsername(user);
      await listFiles(user);
    } catch (err) {
      console.error('Error:', (err as Error).message);
    }
  };

  const listFiles = async (currentUsername: string): Promise<void> => {
    try {
      const userPath = getUserPath(currentUsername);
      const result = await list({ path: `${userPath}/` });
      setFiles(result.items.map((item) => ({ key: item.path.split('/').pop() || '' })) || []);
      console.log(result.items);
    } catch (err) {
      console.log(getUserPath(currentUsername));
      console.error('Error listing files:', (err as Error).message);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const finalKey = getFilePath(username, file.name);
      console.log(finalKey);
      await uploadData({ key: finalKey, data: file, options: { contentType: file.type } });
      await listFiles(username);
    } catch (error) {
      console.error('File upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (key: string): Promise<void> => {
    try {
      const filePath = getFilePath(username, key);
      const { url } = await getUrl({ key: filePath });
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error downloading file:', (err as Error).message);
    }
  };

  const handleDelete = async (key: string): Promise<void> => {
    try {
      const filePath = getFilePath(username, key);
      await remove({ key: filePath });
      await listFiles(username);
    } catch (err) {
      console.error('Error deleting file:', (err as Error).message);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      router.push('/auth');
    } catch (err) {
      console.error('Error signing out:', (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <h1 className="text-2xl font-bold">File Management</h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Input type="file" onChange={handleFileUpload} disabled={uploading} className="flex-1" />
              {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
            </div>
            <div className="space-y-2">
              {files.length > 0 ? (
                files.map((file) => (
                  <div key={file.key} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <span className="truncate flex-1">{file.key}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(file.key)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(file.key)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No files found.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
