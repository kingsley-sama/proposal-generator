'use client';

import { useNotification } from '@/contexts/NotificationContext';

interface ImageData {
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  imageData?: string;
}

interface ImageUploadSectionProps {
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
}

export function ImageUploadSection({ images, onImagesChange }: ImageUploadSectionProps) {
  const { showNotification } = useNotification();

  const addImageField = () => {
    onImagesChange([
      ...images,
      {
        title: '',
        description: '', // Description removed as per requirement
        fileName: '',
        fileSize: 0,
        fileType: '',
        imageData: ''
      }
    ]);
  };

  const removeImageField = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const updateImageField = (index: number, field: keyof ImageData, value: any) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], [field]: value };
    onImagesChange(newImages);
  };

  const handleImageUpload = (index: number, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      showNotification('File size must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const newImages = [...images];
      newImages[index] = {
        ...newImages[index],
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        imageData: e.target?.result as string
      };
      onImagesChange(newImages);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mb-10 pb-8 border-b border-gray-200">
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        🖼️ Perspektivbilder
      </h2>
      <p className="text-xs text-gray-700 mb-5">
        Add images with titles and descriptions that will be included on the second-to-last page of the proposal.
      </p>

      <div className="space-y-4">
        {images.map((image, index) => (
          <div
            key={index}
            className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-5 hover:border-slate-800 hover:bg-white transition-all"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-slate-800 text-base">
                Image {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeImageField(index)}
                className="bg-red-500 text-white px-3 py-1.5 rounded-md hover:bg-red-600 transition-colors text-sm"
              >
                🗑️ Remove
              </button>
            </div>

            {/* Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Bild hochladen *
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                  image.imageData
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 bg-white hover:border-slate-800 hover:bg-gray-50'
                }`}
                onClick={() => {
                  const input = document.getElementById(`imageFile-${index}`);
                  input?.click();
                }}
              >
                <div className="text-3xl mb-2">📷</div>
                <div className="text-gray-600 text-sm">
                  {image.imageData ? `✅ ${image.fileName}` : 'Click to upload image'}
                </div>
                <div className="text-gray-700 text-xs mt-1">
                  PNG, JPG, JPEG (Max 5MB)
                </div>
                {image.imageData && (
                  <img
                    src={image.imageData}
                    alt="Preview"
                    className="w-full max-w-[300px] h-auto mx-auto mt-2.5 rounded-md shadow-md border-2 border-gray-300"
                  />
                )}
              </div>
              <input
                type="file"
                id={`imageFile-${index}`}
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(index, file);
                  }
                }}
                className="hidden"
              />
              <span className="text-xs text-gray-700 mt-1 block">
                Optional: This image will be included in the proposal document
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addImageField}
        className="mt-4 px-4 py-2 bg-gray-100 text-slate-800 rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors"
      >
        ➕ Add Image
      </button>
    </div>
  );
}
