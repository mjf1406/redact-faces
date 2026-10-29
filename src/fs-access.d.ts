interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

interface Window {
  showDirectoryPicker(options?: {
    mode?: 'read' | 'readwrite';
  }): Promise<FileSystemDirectoryHandle>;
}

interface Navigator {
  userAgentData?: { brands: { brand: string; version: string }[] };
}

interface GPUAdapter {
  isFallbackAdapter?: boolean;
}

interface GPUAdapterInfo {
  isFallbackAdapter?: boolean;
}
