import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Video, Lock, Globe, Music, Palette, Camera } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    { id: "painting", label: "Peinture", icon: Palette },
    { id: "sculpture", label: "Sculpture", icon: Camera },
    { id: "photography", label: "Photographie", icon: Camera },
    { id: "digital", label: "Art Digital", icon: ImageIcon },
    { id: "music", label: "Musique", icon: Music },
    { id: "video", label: "Vidéo", icon: Video },
  ];

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      
      if (selectedFile.type.startsWith("image/")) {
        setFileType("image");
      } else if (selectedFile.type.startsWith("video/")) {
        setFileType("video");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl("");
    setFileType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePublish = () => {
    if (!file || !title || !category) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }
    
    // Ici on enverrait les données au backend
    console.log({
      file,
      title,
      description,
      category,
      isPublic
    });
    
    alert("Post publié avec succès !");
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Header */}
        <div className="mb-8 pt-4">
          <h1 className="text-white text-4xl mb-2">Créer un Post</h1>
          <p className="text-gray-400">Partagez votre art avec la communauté</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Upload & Preview */}
          <div>
            {/* Upload Zone */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-white bg-gray-800/50"
                    : "border-gray-600 hover:border-gray-500 bg-gray-900/50"
                }`}
                style={isDragging ? { borderColor: "#ff7f00" } : {}}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-white text-xl mb-2">Glissez votre fichier ici</h3>
                <p className="text-gray-400 mb-4">ou cliquez pour parcourir</p>
                
                <div className="flex justify-center gap-4 mt-6">
                  <div className="flex items-center gap-2 text-gray-400">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm">Photos</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Video className="w-5 h-5" />
                    <span className="text-sm">Vidéos</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden bg-black">
                {/* Preview */}
                {fileType === "image" && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-auto rounded-lg"
                  />
                )}
                
                {fileType === "video" && (
                  <video
                    src={previewUrl}
                    controls
                    className="w-full h-auto rounded-lg"
                  />
                )}
                
                {/* Remove Button */}
                <button
                  onClick={removeFile}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 hover:bg-black flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
                
                {/* File Info */}
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-white text-sm mb-1">{file.name}</p>
                  <p className="text-gray-400 text-xs">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Form */}
          <div className="space-y-6">
            {/* Public/Private Toggle */}
            <div>
              <label className="block text-gray-300 mb-3">Visibilité</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsPublic(true)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    isPublic
                      ? "text-white border-2"
                      : "bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600"
                  }`}
                  style={isPublic ? { backgroundColor: "#ff7f00", borderColor: "#ff7f00" } : {}}
                >
                  <Globe className="w-5 h-5" />
                  <span>Public</span>
                </button>
                
                <button
                  onClick={() => setIsPublic(false)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    !isPublic
                      ? "text-white border-2"
                      : "bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600"
                  }`}
                  style={!isPublic ? { backgroundColor: "#000055", borderColor: "#000055" } : {}}
                >
                  <Lock className="w-5 h-5" />
                  <span>Privé</span>
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-2">
                {isPublic
                  ? "Visible par tous les utilisateurs"
                  : "Visible uniquement pour vos abonnés exclusifs"}
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-gray-300 mb-2">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Donnez un titre à votre œuvre"
                className="w-full px-4 py-3 bg-gray-800/50 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre création..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-800/50 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-gray-300 mb-3">
                Catégorie <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                        category === cat.id
                          ? "text-white"
                          : "bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600"
                      }`}
                      style={
                        category === cat.id
                          ? { backgroundColor: "#ff7f00", borderColor: "#ff7f00" }
                          : {}
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Publish Button */}
            <button
              onClick={handlePublish}
              disabled={!file || !title || !category}
              className="w-full py-4 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: "#ff7f00" }}
            >
              Publier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
