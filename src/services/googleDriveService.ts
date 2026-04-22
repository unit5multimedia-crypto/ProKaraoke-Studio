export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  size?: string;
  modifiedTime?: string;
}

export async function listDriveFiles(accessToken: string, query: string = ""): Promise<DriveFile[]> {
  const q = query 
    ? `name contains '${query}' and (mimeType contains 'video/' or mimeType contains 'audio/' or mimeType contains 'text/')`
    : `(mimeType contains 'video/' or mimeType contains 'audio/' or mimeType contains 'text/')`;
    
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink,size,modifiedTime)&pageSize=50`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Google Drive API is not enabled or unauthorized. Please check your Google Cloud Console.');
      }
      throw new Error('Failed to list Drive files');
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (e) {
    console.error("Drive Listing Error:", e);
    return [];
  }
}

export async function getFileContent(fileId: string, accessToken: string): Promise<string> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch file content');
    return await response.text();
  } catch (e) {
    console.error("Drive Fetch Error:", e);
    return "";
  }
}

export function getDriveDownloadUrl(fileId: string, accessToken: string): string {
  // Directly attach the token to the URL so the <video> tag can fetch it
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`;
}
