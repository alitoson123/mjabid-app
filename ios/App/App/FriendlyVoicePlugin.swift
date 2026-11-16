import Foundation
import UIKit
import AVFoundation
import Capacitor
import AgoraRtcKit

/// Foreground-only bridge. A joined channel never starts microphone capture by itself.
@objc(FriendlyVoicePlugin)
public final class FriendlyVoicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FriendlyVoicePlugin"
    public let jsName = "FriendlyVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "join", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "leave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMicrophonePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMicrophone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPlayback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "muteParticipant", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "renewToken", returnType: CAPPluginReturnPromise)
    ]
    private var engine: AgoraRtcEngineKit?
    private var engineDelegate: FriendlyVoiceEvents?
    private var sessionID: String?
    private var epoch: UInt64 = 0
    private var joining: CAPPluginCall?
    private var pendingMicrophone: CAPPluginCall?
    private var microphoneGeneration: UInt64 = 0
    private var microphoneRequestEpoch: UInt64?
    private var microphoneRequestGeneration: UInt64?
    private var microphonePermissionGranted = false
    private var cancelledSessions: [String] = []
    private var joined = false
    fileprivate var connected = false
    fileprivate var microphone = false
    fileprivate var localUID: UInt = 0
    private var observers: [NSObjectProtocol] = []
    private var oldCategory: AVAudioSession.Category?
    private var oldMode: AVAudioSession.Mode?
    private var oldOptions: AVAudioSession.CategoryOptions?

    public override func load() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self else { return }
            // Opening the OS permission prompt is not consent to restart capture after backgrounding.
            if self.pendingMicrophone == nil { self.interrupt("background") }
        })
        observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.interrupt("background") })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.completeMicrophonePermission() })
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            if raw == AVAudioSession.InterruptionType.began.rawValue { self?.interrupt("audio-interruption") }
        })
        observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in self?.interrupt("audio-reset") })
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        // Releasing the WebView/bridge must not leave the SDK singleton capturing audio.
        if let engine = engine {
            engine.muteLocalAudioStream(true)
            engine.enableLocalAudio(false)
            engine.leaveChannel(nil)
            AgoraRtcEngineKit.destroy()
        }
    }

    fileprivate func onEvent(_ generation: UInt64, _ action: @escaping () -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.sessionID != nil, generation == self.epoch else { return }
            action()
        }
    }

    fileprivate func emit(_ type: String, _ fields: [String: Any] = [:]) {
        guard let id = sessionID else { return }
        var data = fields
        data["type"] = type
        data["sessionId"] = id
        notifyListeners("voiceEvent", data: data)
    }

    private func current(_ call: CAPPluginCall) -> Bool {
        guard let id = sessionID, engine != nil, !cancelledSessions.contains(id),
              call.getString("sessionId") == nil || call.getString("sessionId") == id else {
            call.reject("انتهت جلسة الصوت، أعد الاتصال", "E_VOICE_SESSION")
            return false
        }
        return true
    }

    private func uid(_ call: CAPPluginCall) -> UInt? {
        guard let number = call.getDouble("uid"), number >= 1, number <= 4294967295, number.rounded(.down) == number else { return nil }
        return UInt(number)
    }

    private func options(_ publish: Bool) -> AgoraRtcChannelMediaOptions {
        let options = AgoraRtcChannelMediaOptions()
        options.channelProfile = .communication
        options.clientRoleType = .broadcaster
        options.publishMicrophoneTrack = publish
        options.publishCameraTrack = false
        options.publishCustomAudioTrack = false
        // Subscribe only to roster-authorized UIDs through muteParticipant(uid,false).
        options.autoSubscribeAudio = false
        options.autoSubscribeVideo = false
        options.enableAudioRecordingOrPlayout = true
        return options
    }

    private func publicationOptions(_ publish: Bool) -> AgoraRtcChannelMediaOptions {
        let options = AgoraRtcChannelMediaOptions()
        options.publishMicrophoneTrack = publish
        options.enableAudioRecordingOrPlayout = true
        return options
    }

    fileprivate func captureOff() {
        // Network loss/expiry invalidates consent in flight, even after a quick reconnect.
        microphoneGeneration &+= 1
        microphoneRequestEpoch = nil
        microphoneRequestGeneration = nil
        microphonePermissionGranted = false
        if let pending = pendingMicrophone {
            pendingMicrophone = nil
            pending.reject("أُلغي تشغيل المايك؛ شغّله مجددًا عند الاتصال", "E_MIC_CANCELLED")
        }
        let wasEnabled = microphone
        microphone = false
        engine?.muteLocalAudioStream(true)
        engine?.enableLocalAudio(false)
        if joined { engine?.updateChannel(with: publicationOptions(false)) }
        if wasEnabled { emit("microphone", ["enabled": false]) }
    }

    fileprivate func close(_ reason: String) {
        epoch &+= 1
        captureOff()
        joined = false
        connected = false
        joining?.reject("أُلغي الاتصال بالصوت", "E_VOICE_CANCELLED")
        joining = nil
        pendingMicrophone?.reject("أُلغي تشغيل المايك", "E_VOICE_CANCELLED")
        pendingMicrophone = nil
        if engine != nil {
            engine?.leaveChannel(nil)
            AgoraRtcEngineKit.destroy()
            engine = nil
        }
        engineDelegate = nil
        if let category = oldCategory, let mode = oldMode, let options = oldOptions {
            let audio = AVAudioSession.sharedInstance()
            try? audio.setActive(false, options: .notifyOthersOnDeactivation)
            try? audio.setCategory(category, mode: mode, options: options)
        }
        oldCategory = nil; oldMode = nil; oldOptions = nil
        emit("left", ["reason": reason])
        sessionID = nil
        localUID = 0
    }

    private func interrupt(_ reason: String) {
        guard sessionID != nil else { return }
        emit("interrupted", ["reason": reason])
        close(reason)
    }

    @objc func join(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("الصوت غير متاح", "E_VOICE_SESSION"); return }
            guard UIApplication.shared.applicationState == .active,
                  let appID = call.getString("appId"), appID.range(of: "^[a-fA-F0-9]{32}$", options: .regularExpression) != nil,
                  let channel = call.getString("channel"), !channel.isEmpty, channel.utf8.count <= 64,
                  let token = call.getString("token"), token.count >= 16, token.count <= 8192,
                  let id = call.getString("sessionId"), !id.isEmpty, id.count <= 200,
                  let uid = self.uid(call) else { call.reject("بيانات اتصال الصوت غير صالحة", "E_VOICE_ARGUMENT"); return }
            guard !self.cancelledSessions.contains(id) else { call.reject("أُلغي اتصال الصوت", "E_VOICE_CANCELLED"); return }
            self.close("replaced")
            self.sessionID = id
            self.localUID = uid
            self.joining = call
            self.epoch &+= 1
            let generation = self.epoch
            let audio = AVAudioSession.sharedInstance()
            self.oldCategory = audio.category; self.oldMode = audio.mode; self.oldOptions = audio.categoryOptions
            let configuration = AgoraRtcEngineConfig()
            configuration.appId = appID
            configuration.channelProfile = .communication
            let delegate = FriendlyVoiceEvents(owner: self, epoch: generation)
            self.engineDelegate = delegate
            let engine = AgoraRtcEngineKit.sharedEngine(with: configuration, delegate: delegate)
            self.engine = engine
            engine.enableLocalAudio(false)
            engine.muteLocalAudioStream(true)
            engine.setDefaultAudioRouteToSpeakerphone(true)
            engine.enableAudioVolumeIndication(200, smooth: 3, reportVad: true)
            engine.adjustPlaybackSignalVolume(call.getBool("playbackEnabled") == true ? 100 : 0)
            let result = engine.joinChannel(byToken: token, channelId: channel, uid: uid, mediaOptions: self.options(false)) { [weak self] _, assignedUID, _ in
                self?.onEvent(generation) { [weak self] in
                    guard let self = self else { return }
                    self.joined = true
                    self.connected = self.engine?.getConnectionState() == .connected
                    self.emit("joined", ["uid": assignedUID, "microphone": false])
                    self.joining?.resolve(["uid": assignedUID, "sessionId": id, "microphone": false])
                    self.joining = nil
                }
            }
            if result != 0 {
                self.joining = nil
                call.reject("تعذر الاتصال بالصوت", "E_VOICE_JOIN")
                self.close("join-error")
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
                guard let self = self, self.epoch == generation, let pending = self.joining else { return }
                self.joining = nil
                pending.reject("انتهت مهلة الاتصال بالصوت", "E_VOICE_TIMEOUT")
                self.close("timeout")
            }
        }
    }

    @objc func leave(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.resolve(); return }
            let requested = call.getString("sessionId")
            if requested == nil || requested == self.sessionID { self.close("left") }
            call.resolve()
        }
    }

    /// Bypasses the JS mutation queue; a pending OS permission promise cannot delay this.
    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.resolve(); return }
            guard let id = call.getString("sessionId"), !id.isEmpty, id.count <= 200 else {
                call.reject("جلسة غير صالحة", "E_VOICE_ARGUMENT"); return
            }
            if !self.cancelledSessions.contains(id) { self.cancelledSessions.append(id) }
            if self.cancelledSessions.count > 256 { self.cancelledSessions.removeFirst(self.cancelledSessions.count - 256) }
            if id == self.sessionID { self.close("cancelled") }
            call.resolve()
        }
    }

    @objc func getMicrophonePermission(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["granted": AVAudioSession.sharedInstance().recordPermission == .granted])
        }
    }

    @objc func setMicrophone(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("الصوت غير متاح", "E_VOICE_SESSION"); return }
            guard self.current(call) else { return }
            if call.getBool("enabled") != true {
                self.pendingMicrophone?.reject("أُلغي تشغيل المايك", "E_VOICE_CANCELLED")
                self.pendingMicrophone = nil
                self.captureOff(); call.resolve(); return
            }
            guard UIApplication.shared.applicationState == .active, self.joined, self.connected,
                  self.engine?.getConnectionState() == .connected else { call.reject("الصوت غير متصل", "E_VOICE_SESSION"); return }
            guard self.pendingMicrophone == nil else { call.reject("طلب إذن المايك قيد التنفيذ", "E_MIC_PENDING"); return }
            let audio = AVAudioSession.sharedInstance()
            switch audio.recordPermission {
            case .granted: self.enableMicrophone(call)
            case .denied: call.reject("لم يُسمح باستخدام المايك؛ يمكنك الاستماع", "E_MIC_PERMISSION")
            case .undetermined:
                self.pendingMicrophone = call
                let generation = self.epoch
                self.microphoneGeneration &+= 1
                let permissionGeneration = self.microphoneGeneration
                self.microphoneRequestEpoch = generation
                self.microphoneRequestGeneration = permissionGeneration
                self.microphonePermissionGranted = false
                audio.requestRecordPermission { [weak self] granted in
                    DispatchQueue.main.async {
                        guard let self = self, self.pendingMicrophone === call else { return }
                        guard self.epoch == generation, self.microphoneGeneration == permissionGeneration else {
                            self.clearMicrophonePermission()
                            call.reject("أُلغي تشغيل المايك", "E_MIC_CANCELLED"); return
                        }
                        guard granted else {
                            self.clearMicrophonePermission()
                            call.reject("لم يُسمح باستخدام المايك؛ يمكنك الاستماع", "E_MIC_PERMISSION"); return
                        }
                        self.microphonePermissionGranted = true
                        self.completeMicrophonePermission()
                    }
                }
            @unknown default: call.reject("تعذر التحقق من إذن المايك", "E_MIC_PERMISSION")
            }
        }
    }

    private func clearMicrophonePermission() {
        pendingMicrophone = nil
        microphoneRequestEpoch = nil
        microphoneRequestGeneration = nil
        microphonePermissionGranted = false
    }

    private func completeMicrophonePermission() {
        guard let call = pendingMicrophone, microphonePermissionGranted else { return }
        guard microphoneRequestEpoch == epoch, microphoneRequestGeneration == microphoneGeneration else {
            clearMicrophonePermission()
            call.reject("أُلغي تشغيل المايك", "E_MIC_CANCELLED"); return
        }
        // The permission callback may arrive before the system alert restores active state.
        guard UIApplication.shared.applicationState == .active else { return }
        clearMicrophonePermission()
        guard current(call) else { return }
        guard AVAudioSession.sharedInstance().recordPermission == .granted else {
            call.reject("لم يُسمح باستخدام المايك؛ يمكنك الاستماع", "E_MIC_PERMISSION"); return
        }
        enableMicrophone(call)
    }

    private func enableMicrophone(_ call: CAPPluginCall) {
        guard UIApplication.shared.applicationState == .active, joined, connected, let engine = engine,
              engine.getConnectionState() == .connected, let id = sessionID, !cancelledSessions.contains(id) else {
            call.reject("الصوت غير متصل", "E_VOICE_SESSION"); return
        }
        var result = engine.enableLocalAudio(true)
        if result == 0 { result = engine.updateChannel(with: publicationOptions(true)) }
        if result == 0 { result = engine.muteLocalAudioStream(false) }
        guard result == 0 else { captureOff(); call.reject("تعذر تشغيل المايك", "E_MIC_ENABLE"); return }
        microphone = true
        emit("microphone", ["enabled": true])
        call.resolve(["enabled": true])
    }

    @objc func setPlayback(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("الصوت غير متاح", "E_VOICE_SESSION"); return }
            guard self.current(call) else { return }
            let result = self.engine?.adjustPlaybackSignalVolume(call.getBool("enabled") == false ? 0 : 100)
            if result == 0 { call.resolve() } else { call.reject("تعذر ضبط صوت اللاعبين", "E_VOICE_PLAYBACK") }
        }
    }

    @objc func muteParticipant(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("الصوت غير متاح", "E_VOICE_SESSION"); return }
            guard self.current(call) else { return }
            guard let uid = self.uid(call), uid != self.localUID else { call.reject("لاعب غير صالح", "E_VOICE_ARGUMENT"); return }
            let result = self.engine?.muteRemoteAudioStream(uid, mute: call.getBool("muted") != false)
            if result == 0 { call.resolve() } else { call.reject("تعذر كتم اللاعب", "E_VOICE_MUTE") }
        }
    }

    @objc func renewToken(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("الصوت غير متاح", "E_VOICE_SESSION"); return }
            guard self.current(call) else { return }
            guard let token = call.getString("token"), token.count >= 16, token.count <= 8192 else { call.reject("تصريح غير صالح", "E_VOICE_ARGUMENT"); return }
            if self.engine?.renewToken(token) == 0 {
                self.connected = self.engine?.getConnectionState() == .connected
                call.resolve()
            } else { call.reject("تعذر تجديد اتصال الصوت", "E_VOICE_TOKEN") }
        }
    }
}

private final class FriendlyVoiceEvents: NSObject, AgoraRtcEngineDelegate {
    private weak var owner: FriendlyVoicePlugin?
    private let generation: UInt64
    init(owner: FriendlyVoicePlugin, epoch: UInt64) { self.owner = owner; self.generation = epoch }
    private func live(_ action: @escaping (FriendlyVoicePlugin) -> Void) {
        owner?.onEvent(generation) { [weak self] in if let owner = self?.owner { action(owner) } }
    }
    func rtcEngine(_ engine: AgoraRtcEngineKit, reportAudioVolumeIndicationOfSpeakers speakers: [AgoraRtcAudioVolumeInfo], totalVolume: Int) {
        live { owner in
            let ids = speakers.filter { $0.volume > 8 && ($0.uid != 0 || owner.microphone) }.map { $0.uid == 0 ? owner.localUID : $0.uid }
            owner.emit("speaking", ["uids": ids])
        }
    }
    func rtcEngine(_ engine: AgoraRtcEngineKit, tokenPrivilegeWillExpire token: String) { live { $0.emit("token-expiring") } }
    func rtcEngineRequestToken(_ engine: AgoraRtcEngineKit) { live { $0.connected = false; $0.captureOff(); $0.emit("token-expiring") } }
    func rtcEngine(_ engine: AgoraRtcEngineKit, connectionChangedTo state: AgoraConnectionState, reason: AgoraConnectionChangedReason) {
        live { owner in
            let label: String
            switch state {
            case .connected: label = "connected"
            case .connecting: label = "connecting"
            case .reconnecting: label = "reconnecting"
            case .failed: label = "failed"
            default: label = "disconnected"
            }
            owner.connected = state == .connected
            if state != .connected { owner.captureOff() }
            owner.emit("connection", ["state": label, "reason": reason.rawValue])
            if state == .failed { owner.close("connection-failed") }
        }
    }
    func rtcEngine(_ engine: AgoraRtcEngineKit, didOccurError errorCode: AgoraErrorCode) {
        live { owner in
            owner.captureOff()
            owner.emit("error", ["code": errorCode.rawValue, "message": "تعذر تشغيل الصوت"])
            owner.close("sdk-error")
        }
    }
    func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinedOfUid uid: UInt, elapsed: Int) { live { $0.emit("participant-joined", ["uid": uid]) } }
    func rtcEngine(_ engine: AgoraRtcEngineKit, didOfflineOfUid uid: UInt, reason: AgoraUserOfflineReason) { live { $0.emit("participant-left", ["uid": uid]) } }
}
