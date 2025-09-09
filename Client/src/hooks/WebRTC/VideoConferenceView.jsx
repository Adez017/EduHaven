/**
 * VideoConferenceView.js
 *
 * Component that renders the grid of remote participant video streams.
 * Displays all connected participants' video feeds in a conference layout.
 * Manages the rendering of remote video elements and ensures each participant's
 * stream is properly displayed with their associated socket ID for identification.
 *
 * - Renders remote participant video streams
 * - Manages conference grid layout
 * - Handles dynamic video element creation for new participants
 */

const VideoConferenceView = ({ videos }) => {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 h-full">
      {videos.map((video) => (
        <div key={video.socketId} className="bg-gray-800 rounded-lg overflow-hidden relative">
          <video
            data-socket={video.socketId}
            ref={(ref) => {
              if (ref && video.stream) {
                ref.srcObject = video.stream;
              }
            }}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
            User {video.socketId.substring(0, 8)}
          </div>
        </div>
      ))}
      
      {videos.length === 0 && (
        <div className="col-span-2 flex items-center justify-center text-white text-center">
          <div>
            <p className="text-lg mb-2">No other participants</p>
            <p className="text-sm opacity-75">Waiting for others to join...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoConferenceView;
