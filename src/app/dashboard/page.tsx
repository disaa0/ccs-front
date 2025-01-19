'use client';

import { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { post } from 'aws-amplify/api';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Trash2, LogOut, FolderPlus, ArrowLeft, File } from 'lucide-react';
import { amplifyConfig } from '@/amplifyconfiguration';
import { getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth';
import { getUrl, uploadData, remove, list } from 'aws-amplify/storage';
import { Alert, AlertDescription } from '@/components/ui/alert';

Amplify.configure(amplifyConfig);

const BASE_PATH = 'public';
const TEMP_FOLDER = '.temp';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

type ListOutputItem = {
  key: string;
  isDirectory: boolean;
  path: string;
};

interface FileValidationResult {
  valid: boolean;
  message: string;
}

export default function Dashboard() {
  const [files, setFiles] = useState<ListOutputItem[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [showNewFolderInput, setShowNewFolderInput] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  const getUserRootPath = (user: string): string => `${user}`;
  const getUserTempPath = (user: string): string => `${getUserRootPath(user)}/${TEMP_FOLDER}`;
  const getFilePath = (user: string, filename: string): string =>
    `${getUserRootPath(user)}/${filename}`;
  const getFullFilePath = (user: string, filename: string): string =>
    currentPath ? `${getUserRootPath(user)}/${currentPath}/${filename}` : getFilePath(user, filename);
  const getAbsolutePath = (path: string): string => {
    return `${BASE_PATH}/${path}`;
  };
  const validateFileLocally = (file: File): FileValidationResult => {
    // Basic file validation
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, message: 'File size exceeds 100MB limit' };
    }

    return { valid: true, message: 'File is valid' };
  };

  const requiresServerValidation = (filename: string): boolean => {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'zip';
  };
  const processServerValidation = async (tempKey: string, finalKey: string, filename: string): Promise<boolean> => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    // Remove the leading slash if present and strip bucket name from path
    const cleanTempKey = getAbsolutePath(tempKey.replace(/^\//, ''));
    const cleanFinalKey = getAbsolutePath(finalKey.replace(/^\//, ''));

    try {
      const response = await post({
        apiName: 'tul_ccs_api',
        path: '/validate-zip',
        options: {
          body: {
            key: cleanTempKey,
            filename,
            finalKey: cleanFinalKey
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        }
      }).response;
      const result = await response.body.json() as { valid: boolean; message: string };
      if (!result?.valid) {
        setError(result?.message || 'Invalid file');
        return false;
      }
      return true;
    } catch (err) {
      console.error('Validation error:', err);
      setError('Failed to validate file');
      return false;
    }
  };

  const checkAuth = async (): Promise<void> => {
    try {
      const session = await fetchAuthSession();
      const user = session.identityId || "";
      setUsername(user);
      await listFiles(user);
    } catch (err) {
      console.error('Error:', (err as Error).message);
      router.push('/auth');
    }
  };

  const listFiles = async (currentUsername: string): Promise<void> => {
    try {
      const userPath = getAbsolutePath(getUserRootPath(currentUsername));
      const fullPath = currentPath ? `${userPath}/${currentPath}/` : `${userPath}/`;

      const result = await list({ path: fullPath });

      // Create a map to track directories
      const dirMap = new Map<string, boolean>();

      // First pass: identify all directories
      result.items.forEach(item => {
        const relativePath = item.path.replace(`${userPath}/`, '');
        const parts = relativePath.split('/');

        // Add each directory level to the map
        let currentDir = '';
        parts.forEach((part, index) => {
          if (index < parts.length - 1) {
            currentDir = currentDir ? `${currentDir}/${part}` : part;
            dirMap.set(currentDir, true);
          }
        });
      });

      // Process files and explicit directories
      const processedItems = result.items
        .filter(item => !item.path.includes(TEMP_FOLDER)) // Filter out temp files
        .reduce((acc: ListOutputItem[], item) => {
          const relativePath = item.path.replace(`${userPath}/`, '');
          const parts = relativePath.split('/');
          const fileName = parts.pop() || '';

          // Skip if it's a directory marker
          if (fileName === '') return acc;

          // Add file or directory to the list
          acc.push({
            key: fileName,
            path: relativePath,
            isDirectory: dirMap.has(relativePath) || item.path.endsWith('/')
          });

          return acc;
        }, []);

      // Remove duplicates and sort (directories first)
      const uniqueItems = Array.from(new Map(processedItems.map(item =>
        [item.key, item]
      )).values()).sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.key.localeCompare(b.key);
        }
        return a.isDirectory ? -1 : 1;
      });

      setFiles(uniqueItems);
    } catch (err) {
      console.error('Error listing files:', err);
      setError('Failed to list files');
    }
  };

  useEffect(() => {
    checkAuth();
  }, [currentPath]);
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Local validation
    const validation = validateFileLocally(file);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    try {
      setUploading(true);
      setError('');

      const tempKey = `${getUserTempPath(username)}/${file.name}`;
      const finalKey = getFullFilePath(username, file.name);
      console.log(finalKey);
      console.log(tempKey);

      if (requiresServerValidation(file.name)) {
        // Upload to temp folder first
        await uploadData({
          key: tempKey,
          data: file,
          options: { contentType: file.type }
        });

        // Validate with server
        const isValid = await processServerValidation(tempKey, finalKey, file.name);
        if (!isValid) {
          setUploading(false);
          return;
        }
      } else {
        // Direct upload
        await uploadData({
          key: finalKey,
          data: file,
          options: { contentType: file.type }
        });
      }

      await listFiles(username);
    } catch (error) {
      console.error('File upload error:', error);
      setError('Failed to upload file');
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';  // Reset file input
      }
    }
  };

  const handleCreateDirectory = async (): Promise<void> => {
    if (!newFolderName.trim()) return;

    try {
      const directoryPath = getFilePath(username, `${newFolderName.trim()}/`);
      // Create an empty file to mark directory
      await uploadData({
        key: directoryPath,
        data: new Blob(['']),
        options: { contentType: 'application/x-directory' }
      });

      setNewFolderName('');
      setShowNewFolderInput(false);
      await listFiles(username);
    } catch (err) {
      console.error('Error creating directory:', err);
      setError('Failed to create directory');
    }
  };

  const handleDownload = async (key: string): Promise<void> => {
    try {
      const filePath = getFilePath(username, key);
      const { url } = await getUrl({ key: filePath });
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  const handleDelete = async (key: string): Promise<void> => {
    try {
      const filePath = getFilePath(username, key);
      await remove({ key: filePath });
      await listFiles(username);
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to delete file');
    }
  };

  const handleNavigate = (directory: string) => {
    setCurrentPath(prevPath =>
      prevPath ? `${prevPath}/${directory}` : directory
    );
  };

  const handleBack = () => {
    setCurrentPath(prevPath => {
      const parts = prevPath.split('/');
      parts.pop();
      return parts.join('/');
    });
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      router.push('/auth');
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">File Management</h1>
            {currentPath && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-4">
              <Input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => setShowNewFolderInput(true)}
                disabled={showNewFolderInput}
              >
                <FolderPlus className="w-4 h-4 mr-2" /> New Folder
              </Button>
            </div>

            {showNewFolderInput && (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleCreateDirectory}>Create</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {uploading && <p className="text-sm text-gray-500">Uploading...</p>}

            <div className="space-y-2">
              {files.length > 0 ? (
                files.map((file) => (
                  <div
                    key={file.key}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div
                      className="flex items-center gap-2 truncate flex-1"
                      onClick={() => file.isDirectory && handleNavigate(file.key)}
                      style={{ cursor: file.isDirectory ? 'pointer' : 'default' }}
                    >
                      {file.isDirectory ? (
                        <FolderPlus className="w-4 h-4" />
                      ) : (
                        <File className="w-4 h-4" />
                      )}
                      <span>{file.key}</span>
                    </div>
                    {!file.isDirectory && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(file.key)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(file.key)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
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
