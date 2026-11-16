import Capacitor

final class FriendlyVoiceViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FriendlyVoicePlugin())
    }
}
